import { CAMPUS_TIMEZONE, dateKey } from "./format.js";
export function formatTimeSlot(hour, minute) {
  const hStr = String(hour).padStart(2, "0");
  const mStr = String(minute).padStart(2, "0");
  return `${hStr}:${mStr}`;
}

export function formatDisplayTime(hour, minute) {
  const normalizedHour = hour % 24;
  const period = normalizedHour >= 12 ? "PM" : "AM";
  const displayHour = normalizedHour % 12 || 12;
  const mStr = minute === 0 ? ":00" : `:${String(minute).padStart(2, "0")}`;
  return `${displayHour}${mStr} ${period}`;
}

export function getCampusHourAndMinute(dateObj) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(dateObj));
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute").value, 10);
  return { hour, minute };
}

export function layoutDayEvents(
  dayEvents,
  startHour = 0,
  endHour = 24,
  hourHeight = 60,
) {
  if (!dayEvents || dayEvents.length === 0) return [];

  const sorted = [...dayEvents].sort((a, b) => {
    const diff = new Date(a.start_time) - new Date(b.start_time);
    if (diff !== 0) return diff;
    return new Date(b.end_time) - new Date(a.end_time);
  });

  const lanes = [];
  const clusterSizes = [];
  let cluster = -1;
  let clusterEnd = 0;
  const placed = sorted.map((evt) => {
    const sObj = getCampusHourAndMinute(evt.start_time);
    const eObj = getCampusHourAndMinute(evt.end_time);
    const sMinutes = sObj.hour * 60 + sObj.minute - startHour * 60;
    const eMinutes =
      Math.min(
        endHour * 60,
        eObj.hour * 60 +
          eObj.minute +
          (dateKey(evt.end_time) !== dateKey(evt.start_time) ? 24 * 60 : 0),
      ) -
      startHour * 60;
    const durMinutes = Math.max(30, eMinutes - sMinutes);

    const top = Math.max(0, sMinutes * (hourHeight / 60));
    const height = Math.max(26, durMinutes * (hourHeight / 60) - 2);

    const sEpoch = new Date(evt.start_time).getTime();
    const eEpoch = new Date(evt.end_time).getTime();

    // All overlapping events in a connected group need the same column width.
    if (sEpoch >= clusterEnd) {
      cluster++;
      lanes.length = 0;
      clusterSizes[cluster] = 0;
    }
    clusterEnd = Math.max(clusterEnd, eEpoch);

    let lane = 0;
    while (lanes[lane] && lanes[lane] > sEpoch) {
      lane++;
    }
    lanes[lane] = eEpoch;
    clusterSizes[cluster] = Math.max(clusterSizes[cluster], lane + 1);

    return {
      ...evt,
      top,
      height,
      lane,
      cluster,
      sEpoch,
      eEpoch,
    };
  });

  return placed.map((evt) => {
    const totalLanes = clusterSizes[evt.cluster];
    const width = 100 / totalLanes;
    const left = evt.lane * width;
    return {
      ...evt,
      top: evt.top,
      height: evt.height,
      left,
      width,
    };
  });
}
