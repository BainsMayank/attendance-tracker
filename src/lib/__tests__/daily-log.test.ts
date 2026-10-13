import { subjectDay } from "../subject-history";
import { monthBounds, resolveDay, type LogData } from "../daily-log";
const meta = { createdAt: 1, updatedAt: 1, revision: 1 };
function fixture(): LogData {
  return {
    semester: {
      ...meta,
      id: "sem",
      name: "Term",
      startsOn: "2026-01-07",
      endsOn: "2026-02-02",
      timezone: "Asia/Kolkata",
      weekAnchor: "2026-01-05",
      targetBps: 7500,
      archivedAt: null,
    },
    subjects: [
      {
        ...meta,
        id: "subject",
        semesterId: "sem",
        name: "Math",
        normalizedName: "math",
        color: "#4144D8",
        code: null,
        icon: null,
        teacher: null,
        credits: null,
        targetBps: null,
        archivedAt: null,
        sortOrder: 0,
      },
    ],
    types: [
      {
        ...meta,
        id: "type",
        semesterId: "sem",
        name: "Lab",
        normalizedName: "lab",
        defaultCountsAs: 2,
        archivedAt: null,
      },
    ],
    versions: [
      {
        ...meta,
        id: "v1",
        semesterId: "sem",
        label: "First",
        effectiveFrom: "2026-01-07",
        effectiveUntil: "2026-01-14",
        supersededAt: null,
      },
      {
        ...meta,
        id: "v2",
        semesterId: "sem",
        label: "Next",
        effectiveFrom: "2026-01-14",
        effectiveUntil: null,
        supersededAt: null,
      },
    ],
    slots: [
      {
        ...meta,
        id: "slot",
        semesterId: "sem",
        versionId: "v1",
        subjectId: "subject",
        classTypeId: "type",
        weekday: 3,
        parity: "odd",
        startMinute: 540,
        endMinute: 660,
        room: "Lab",
        teacher: null,
        lineageId: null,
        countsAs: 2,
      },
      {
        ...meta,
        id: "clone",
        semesterId: "sem",
        versionId: "v2",
        subjectId: "subject",
        classTypeId: "type",
        weekday: 3,
        parity: "even",
        startMinute: 600,
        endMinute: 720,
        room: "New lab",
        teacher: null,
        lineageId: "slot",
        countsAs: 2,
      },
    ],
    extras: [],
    holidays: [],
    records: [],
    notes: [],
  };
}
test("semester bounds are inclusive and dates must be real calendar days", () => {
  const data = fixture();
  expect(resolveDay(data, "2026-01-06")).toMatchObject({
    outside: true,
    classes: [],
  });
  expect(resolveDay(data, "2026-01-07").classes).toHaveLength(1);
  expect(resolveDay(data, "2026-02-02").outside).toBe(false);
  expect(resolveDay(data, "2026-02-03").state).toBe("outside");
  expect(() => resolveDay(data, "2026-02-30")).toThrow();
});
test("effective version exclusive end, weekday and semester parity do not reset", () => {
  const data = fixture();
  expect(resolveDay(data, "2026-01-07").classes[0].slotId).toBe("slot");
  expect(resolveDay(data, "2026-01-14").classes[0].slotId).toBe("clone");
  expect(resolveDay(data, "2026-01-15").classes).toEqual([]);
  expect(resolveDay(data, "2026-01-21").classes).toEqual([]);
  data.slots[1].parity = "all";
  expect(resolveDay(data, "2026-01-21").classes).toHaveLength(1);
});
test("holidays retain rows as neutral, overlap by union, and scoped holidays do not mark the whole day", () => {
  const data = fixture();
  data.holidays = [
    {
      ...meta,
      id: "h1",
      semesterId: "sem",
      subjectId: "subject",
      title: "Off",
      startsOn: "2026-01-07",
      endsOn: "2026-01-07",
    },
  ];
  expect(resolveDay(data, "2026-01-07")).toMatchObject({
    holiday: false,
    state: "allMarked",
    classes: [{ status: "neutral", holiday: true }],
  });
  data.holidays.push({ ...data.holidays[0], id: "h2", subjectId: null });
  expect(resolveDay(data, "2026-01-07")).toMatchObject({
    state: "holiday",
    classes: [{ countsAs: 2, status: "neutral" }],
  });
  expect(resolveDay(data, "2026-01-07").classes).toHaveLength(1);
});
test("extras ignore parity/version gaps, cancelled extras disappear, explicit holiday overrides remain eligible", () => {
  const data = fixture();
  data.versions = [];
  data.extras = [
    {
      ...meta,
      id: "extra",
      semesterId: "sem",
      subjectId: "subject",
      classTypeId: "type",
      onDate: "2026-01-08",
      startMinute: 800,
      endMinute: 860,
      room: null,
      countsAs: 2,
      cancelledAt: null,
      allowOnHoliday: false,
    },
  ];
  expect(resolveDay(data, "2026-01-08")).toMatchObject({
    configured: false,
    state: "unconfigured",
    classes: [{ extraClassId: "extra" }],
  });
  data.holidays = [
    {
      ...meta,
      id: "h",
      semesterId: "sem",
      subjectId: null,
      title: "Off",
      startsOn: "2026-01-08",
      endsOn: "2026-01-08",
    },
  ];
  expect(resolveDay(data, "2026-01-08").classes[0].status).toBe("neutral");
  data.extras[0].allowOnHoliday = true;
  expect(resolveDay(data, "2026-01-08").classes[0]).toMatchObject({
    status: null,
    holiday: false,
  });
  data.extras[0].cancelledAt = 2;
  expect(resolveDay(data, "2026-01-08").classes).toEqual([]);
});
test("snapshots and notes survive clones; historical time, type, weight and status win once", () => {
  const data = fixture();
  data.versions[0].supersededAt = 2;
  data.versions[1].effectiveFrom = data.semester.startsOn;
  data.slots[1].parity = "all";
  data.records = [
    {
      ...meta,
      id: "record",
      semesterId: "sem",
      subjectId: "subject",
      onDate: "2026-01-07",
      kind: "occurrence",
      occurrenceKey: "slot:slot:2026-01-07",
      slotId: "slot",
      extraClassId: null,
      classTypeId: "type",
      classTypeName: "Frozen lab",
      startMinute: 540,
      endMinute: 660,
      room: "Old lab",
      countsAs: 3,
      status: "absent",
      attendedDelta: 0,
      heldDelta: 3,
      reason: null,
      source: "manual",
    },
  ];
  data.notes = [
    {
      ...meta,
      id: "note",
      semesterId: "sem",
      subjectId: "subject",
      onDate: "2026-01-07",
      occurrenceKey: "slot:slot:2026-01-07",
      body: "Bring notes",
    },
  ];
  const before = JSON.stringify(data);
  expect(resolveDay(data, "2026-01-07").classes).toMatchObject([
    {
      slotId: "slot",
      typeName: "Frozen lab",
      startMinute: 540,
      countsAs: 3,
      status: "absent",
      note: { body: "Bring notes" },
    },
  ]);
  expect(resolveDay(data, "2026-01-07").classes).toHaveLength(1);
  expect(JSON.stringify(data)).toBe(before);
});
test("completeness counts rows, not weighted units, and an adjustment is not a class", () => {
  const data = fixture();
  expect(resolveDay(data, "2026-01-07").state).toBe("unmarked");
  data.extras.push({
    ...meta,
    id: "extra",
    semesterId: "sem",
    subjectId: "subject",
    classTypeId: "type",
    onDate: "2026-01-07",
    startMinute: 800,
    endMinute: 860,
    room: null,
    countsAs: 5,
    cancelledAt: null,
    allowOnHoliday: false,
  });
  data.holidays.push({
    ...meta,
    id: "h",
    semesterId: "sem",
    subjectId: null,
    title: "Off",
    startsOn: "2026-01-07",
    endsOn: "2026-01-07",
  });
  data.extras[0].allowOnHoliday = true;
  expect(resolveDay(data, "2026-01-07")).toMatchObject({
    state: "partlyMarked",
    marked: 1,
  });
  expect(resolveDay(data, "2026-01-09").state).toBe("noClasses");
});
test("month arithmetic handles leap years and year transitions", () => {
  expect(monthBounds("2024-02-12")).toMatchObject({
    end: "2024-02-29",
    next: "2024-03-01",
  });
  expect(monthBounds("2026-12-20").next).toBe("2027-01-01");
  expect(monthBounds("2026-01-02").previous).toBe("2025-12-01");
});

test("subject heatmap distinguishes pending, holidays, neutral, mixed and outside dates", () => {
  const data = fixture();
  expect(subjectDay(data, "2026-01-06", "subject").state).toBe("outside");
  expect(subjectDay(data, "2026-01-07", "subject").state).toBe("pending");
  expect(subjectDay(data, "2026-01-08", "subject").state).toBe("noClasses");
  data.holidays.push({
    ...meta,
    id: "h",
    semesterId: "sem",
    subjectId: null,
    title: "Off",
    startsOn: "2026-01-07",
    endsOn: "2026-01-07",
  });
  expect(subjectDay(data, "2026-01-07", "subject").state).toBe("holiday");
  data.holidays = [];
  const row = {
    ...meta,
    id: "r",
    semesterId: "sem",
    subjectId: "subject",
    onDate: "2026-01-07",
    kind: "occurrence" as const,
    occurrenceKey: "slot:slot:2026-01-07",
    slotId: "slot",
    extraClassId: null,
    classTypeId: "type",
    classTypeName: "Lab",
    startMinute: 540,
    endMinute: 660,
    room: null,
    countsAs: 2,
    status: "neutral" as const,
    attendedDelta: 0,
    heldDelta: 0,
    reason: null,
    source: "manual" as const,
  };
  data.records = [row];
  expect(subjectDay(data, "2026-01-07", "subject").state).toBe("neutral");
  data.records = [
    { ...row, status: "present", attendedDelta: 2, heldDelta: 2 },
  ];
  expect(subjectDay(data, "2026-01-07", "subject").state).toBe("present");
  data.records = [{ ...row, status: "absent", heldDelta: 2 }];
  expect(subjectDay(data, "2026-01-07", "subject").state).toBe("absent");
  data.records.push({
    ...row,
    id: "r2",
    occurrenceKey: "extra:extra",
    slotId: null,
    extraClassId: "extra",
    status: "present",
    attendedDelta: 2,
    heldDelta: 2,
  });
  expect(subjectDay(data, "2026-01-07", "subject")).toMatchObject({
    state: "mixed",
    present: 1,
    absent: 1,
  });
  data.versions = [];
  data.records = [];
  expect(subjectDay(data, "2026-01-07", "subject").state).toBe("unconfigured");
});
