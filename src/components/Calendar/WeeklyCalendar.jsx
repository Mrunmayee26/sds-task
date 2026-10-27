import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Plus } from 'lucide-react';
import {
  CAMPUS_TIMEZONE,
  dateKey,
  statusLabel,
  timeLabel,
} from '../../services/format';

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 60;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i,
);
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function formatTimeSlot(hour, minute) {
  const hStr = String(hour).padStart(2, '0');
  const mStr = String(minute).padStart(2, '0');
  return `${hStr}:${mStr}`;
}

export function formatDisplayTime(hour, minute) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
  const mStr = minute === 0 ? ':00' : `:${String(minute).padStart(2, '0')}`;
  return `${displayHour}${mStr} ${period}`;
}

export function getCampusHourAndMinute(dateObj) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAMPUS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(dateObj));
  const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  return { hour, minute };
}

export function layoutDayEvents(
  dayEvents,
  startHour = 7,
  endHour = 22,
  hourHeight = 60,
) {
  if (!dayEvents || dayEvents.length === 0) return [];

  const sorted = [...dayEvents].sort((a, b) => {
    const diff = new Date(a.start_time) - new Date(b.start_time);
    if (diff !== 0) return diff;
    return new Date(b.end_time) - new Date(a.end_time);
  });

  const lanes = [];
  const placed = sorted.map((evt) => {
    const sObj = getCampusHourAndMinute(evt.start_time);
    const eObj = getCampusHourAndMinute(evt.end_time);
    const sMinutes = sObj.hour * 60 + sObj.minute - startHour * 60;
    const eMinutes = eObj.hour * 60 + eObj.minute - startHour * 60;
    const durMinutes = Math.max(30, eMinutes - sMinutes);

    const top = Math.max(0, sMinutes * (hourHeight / 60));
    const height = Math.max(26, durMinutes * (hourHeight / 60) - 2);

    const sEpoch = new Date(evt.start_time).getTime();
    const eEpoch = new Date(evt.end_time).getTime();

    let lane = 0;
    while (lanes[lane] && lanes[lane] > sEpoch) {
      lane++;
    }
    lanes[lane] = eEpoch;

    return {
      ...evt,
      top,
      height,
      lane,
      sEpoch,
      eEpoch,
    };
  });

  return placed.map((evt) => {
    const overlaps = placed.filter((other) => {
      return evt.sEpoch < other.eEpoch && other.sEpoch < evt.eEpoch;
    });
    const totalLanes = Math.max(...overlaps.map((o) => o.lane)) + 1;
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

export default function WeeklyCalendar({
  bookings = [],
  weekStart,
  status = '',
  role = 'applicant',
  onSelectDate,
}) {
  const timetableScrollRef = useRef(null);
  const [nowTime, setNowTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timetableScrollRef.current) {
      const currentHour = getCampusHourAndMinute(new Date()).hour;
      const targetHour = Math.max(START_HOUR, Math.min(19, currentHour - 1));
      timetableScrollRef.current.scrollTop =
        (targetHour - START_HOUR) * HOUR_HEIGHT;
    }
  }, [weekStart]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const nowObj = getCampusHourAndMinute(nowTime);
  const nowMinutes = nowObj.hour * 60 + nowObj.minute - START_HOUR * 60;
  const nowIndicatorTop =
    nowMinutes >= 0 && nowMinutes <= (END_HOUR - START_HOUR) * 60
      ? nowMinutes * (HOUR_HEIGHT / 60)
      : null;

  const getEventsForDay = (dayDate) => {
    const dayKey = dateKey(dayDate);
    return bookings
      .filter((row) => {
        if (!row.start_time) return false;
        const matchesDate = dateKey(row.start_time) === dayKey;
        const matchesStatus = !status || row.status === status;
        return matchesDate && matchesStatus;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  };

  return (
    <div className="gcal-container">
      {/* Sticky Header with Day Names & Dates */}
      <div className="gcal-header-row">
        <div className="gcal-time-col-header">
          <span className="gcal-tz-label">IST</span>
        </div>
        <div className="gcal-days-header-grid">
          {weekDays.map((dayDate, idx) => {
            const isToday = dateKey(dayDate) === dateKey(new Date());
            return (
              <div
                key={dateKey(dayDate)}
                className={`gcal-day-header-cell ${isToday ? 'is-today' : ''}`}
                onClick={() => onSelectDate && onSelectDate(dateKey(dayDate))}
                title="Click to view daily list for this date"
              >
                <span className="gcal-day-name">{DAY_NAMES[idx]}</span>
                <span className={`gcal-day-num ${isToday ? 'is-today' : ''}`}>
                  {dayDate.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable Timetable with Hour Axis and 7 Day Columns */}
      <div className="gcal-body-scroll" ref={timetableScrollRef}>
        <div className="gcal-body-grid">
          {/* Time labels axis */}
          <div className="gcal-time-column">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="gcal-hour-label"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span>
                  {hour === 12
                    ? '12 PM'
                    : hour > 12
                    ? `${hour - 12} PM`
                    : `${hour} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* 7 Day Columns */}
          <div className="gcal-days-grid">
            {weekDays.map((dayDate) => {
              const isToday = dateKey(dayDate) === dateKey(new Date());
              const dayEvents = getEventsForDay(dayDate);
              const layoutEvents = layoutDayEvents(
                dayEvents,
                START_HOUR,
                END_HOUR,
                HOUR_HEIGHT,
              );

              return (
                <div
                  key={dateKey(dayDate)}
                  className={`gcal-day-column ${isToday ? 'is-today' : ''}`}
                >
                  {/* Hour grid cells & interactive booking slot blocks */}
                  {HOURS.map((hour) => {
                    const dKey = dateKey(dayDate);
                    const isPastDate = dKey < dateKey(new Date());
                    const isTodayDate = dKey === dateKey(new Date());

                    // Slot 1: :00
                    const isSlot1Past =
                      isPastDate ||
                      (isTodayDate &&
                        (nowObj.hour > hour ||
                          (nowObj.hour === hour && nowObj.minute > 0)));
                    const slot1Start = formatTimeSlot(hour, 0);
                    const slot1End = formatTimeSlot(Math.min(23, hour + 1), 0);
                    const slot1Url = `/${role}/book?date=${dKey}&start_time=${slot1Start}&end_time=${slot1End}`;

                    // Slot 2: :30
                    const isSlot2Past =
                      isPastDate ||
                      (isTodayDate &&
                        (nowObj.hour > hour ||
                          (nowObj.hour === hour && nowObj.minute >= 30)));
                    const slot2Start = formatTimeSlot(hour, 30);
                    const slot2End = formatTimeSlot(Math.min(23, hour + 1), 30);
                    const slot2Url = `/${role}/book?date=${dKey}&start_time=${slot2Start}&end_time=${slot2End}`;

                    return (
                      <div
                        key={hour}
                        className="gcal-hour-cell"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      >
                        <Link
                          to={slot1Url}
                          className={`gcal-book-slot slot-top ${isSlot1Past ? 'is-past' : ''}`}
                          title={`Book venue on ${dKey} from ${formatDisplayTime(hour, 0)} to ${formatDisplayTime(hour + 1, 0)}`}
                        >
                          <span className="gcal-slot-label">
                            <Plus size={11} className="gcal-slot-icon" />
                            <span className="gcal-slot-text">
                              Book {formatDisplayTime(hour, 0)}
                            </span>
                          </span>
                        </Link>

                        <div className="gcal-half-hour-line" />

                        <Link
                          to={slot2Url}
                          className={`gcal-book-slot slot-bottom ${isSlot2Past ? 'is-past' : ''}`}
                          title={`Book venue on ${dKey} from ${formatDisplayTime(hour, 30)} to ${formatDisplayTime(hour + 1, 30)}`}
                        >
                          <span className="gcal-slot-label">
                            <Plus size={11} className="gcal-slot-icon" />
                            <span className="gcal-slot-text">
                              Book {formatDisplayTime(hour, 30)}
                            </span>
                          </span>
                        </Link>
                      </div>
                    );
                  })}

                  {/* Red line indicator for current time */}
                  {isToday && nowIndicatorTop !== null && (
                    <div
                      className="gcal-now-line"
                      style={{ top: `${nowIndicatorTop}px` }}
                      title="Current time"
                    >
                      <div className="gcal-now-dot" />
                    </div>
                  )}

                  {/* Positioned Event Blocks */}
                  {layoutEvents.map((evt) => (
                    <Link
                      key={evt.application_id}
                      to={`/${role}/bookings/${evt.application_id}`}
                      className={`gcal-event-block status-${evt.status}`}
                      style={{
                        top: `${evt.top}px`,
                        height: `${evt.height}px`,
                        left: `${evt.left}%`,
                        width: `calc(${evt.width}% - 4px)`,
                      }}
                      title={`#${evt.application_id}: ${evt.purpose} (${timeLabel(evt.start_time)} – ${timeLabel(evt.end_time)}) at ${evt.venue_name}`}
                    >
                      <div className="gcal-event-header">
                        <span className="gcal-event-title">{evt.purpose}</span>
                        <span
                          className={`gcal-status-pill status-${evt.status}`}
                        >
                          {statusLabel(evt.status)}
                        </span>
                      </div>
                      <div className="gcal-event-time">
                        <Clock size={10} />
                        <span>
                          {timeLabel(evt.start_time)} –{' '}
                          {timeLabel(evt.end_time)}
                        </span>
                      </div>
                      {evt.height > 44 && (
                        <div className="gcal-event-venue">
                          <MapPin size={10} style={{ flexShrink: 0 }} />
                          <span>{evt.venue_name}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
