const ExcelJS = require('exceljs');
const Meeting = require('../models/Meeting');

/**
 * Build attendance rows from a meeting document.
 * Unlimited participants — no artificial cap.
 */
const buildAttendanceRows = (meeting) => {
  const rows = (meeting.participants || []).map((p, index) => {
    const joinedAt = p.joinedAt ? new Date(p.joinedAt) : null;
    const leftAt = p.leftAt ? new Date(p.leftAt) : null;
    let durationMin = p.durationMinutes || 0;
    if (joinedAt && leftAt && !durationMin) {
      durationMin = Math.max(0, Math.floor((leftAt - joinedAt) / 60000));
    } else if (joinedAt && p.isActive && meeting.actualStart) {
      durationMin = Math.max(0, Math.floor((Date.now() - joinedAt.getTime()) / 60000));
    }

    return {
      no: index + 1,
      name: p.displayName || 'Unknown',
      email: p.email || '',
      role: p.role || 'participant',
      joinedAt: joinedAt ? joinedAt.toISOString() : '',
      joinedAtLocal: joinedAt ? joinedAt.toLocaleString() : '',
      leftAt: leftAt ? leftAt.toISOString() : p.isActive ? 'Still in meeting' : '',
      leftAtLocal: leftAt ? leftAt.toLocaleString() : p.isActive ? 'Still in meeting' : '',
      durationMinutes: durationMin,
      status: p.isActive ? 'Active' : 'Left',
    };
  });

  return rows;
};

const getAttendanceSummary = async (meetingId) => {
  const meeting = await Meeting.findOne({ meetingId: meetingId.toUpperCase() })
    .populate('hostId', 'displayName email')
    .lean();

  if (!meeting) {
    const err = new Error('Meeting not found');
    err.statusCode = 404;
    throw err;
  }

  const rows = buildAttendanceRows(meeting);
  const totalParticipants = rows.length;
  const currentlyActive = rows.filter((r) => r.status === 'Active').length;

  return {
    meetingId: meeting.meetingId,
    title: meeting.title,
    host: meeting.hostId?.displayName || 'Unknown',
    hostEmail: meeting.hostId?.email || '',
    status: meeting.status,
    type: meeting.type,
    actualStart: meeting.actualStart,
    actualEnd: meeting.actualEnd,
    durationMinutes: meeting.durationMinutes || 0,
    totalParticipants,
    currentlyActive,
    participants: rows,
  };
};

/**
 * Generate Excel workbook buffer for attendance.
 */
const generateAttendanceExcel = async (meetingId) => {
  const summary = await getAttendanceSummary(meetingId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MeetLink';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Attendance', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Header info
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = `MeetLink Attendance Report — ${summary.title}`;
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF4F46E5' } };

  sheet.getCell('A2').value = 'Meeting ID:';
  sheet.getCell('B2').value = summary.meetingId;
  sheet.getCell('A3').value = 'Host:';
  sheet.getCell('B3').value = `${summary.host} (${summary.hostEmail})`;
  sheet.getCell('A4').value = 'Status:';
  sheet.getCell('B4').value = summary.status;
  sheet.getCell('A5').value = 'Total Participants:';
  sheet.getCell('B5').value = summary.totalParticipants;
  sheet.getCell('A6').value = 'Currently Active:';
  sheet.getCell('B6').value = summary.currentlyActive;
  sheet.getCell('A7').value = 'Generated At:';
  sheet.getCell('B7').value = new Date().toLocaleString();

  // Table headers at row 9
  const headers = [
    'No.',
    'Name',
    'Email',
    'Role',
    'Joined At',
    'Left At',
    'Duration (min)',
    'Status',
  ];
  const headerRow = sheet.getRow(9);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    cell.alignment = { horizontal: 'center' };
  });

  summary.participants.forEach((p, idx) => {
    const row = sheet.getRow(10 + idx);
    row.values = [
      p.no,
      p.name,
      p.email,
      p.role,
      p.joinedAtLocal || p.joinedAt,
      p.leftAtLocal || p.leftAt,
      p.durationMinutes,
      p.status,
    ];
  });

  // Column widths
  sheet.columns = [
    { width: 8 },
    { width: 24 },
    { width: 28 },
    { width: 12 },
    { width: 22 },
    { width: 22 },
    { width: 14 },
    { width: 12 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    filename: `MeetLink_Attendance_${summary.meetingId}_${Date.now()}.xlsx`,
    summary,
  };
};

module.exports = {
  getAttendanceSummary,
  generateAttendanceExcel,
  buildAttendanceRows,
};