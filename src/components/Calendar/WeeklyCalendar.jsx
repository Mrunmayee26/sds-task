import {
  formatTimeSlot,
  formatDisplayTime,
  getCampusHourAndMinute,
  layoutDayEvents,
} from "../../services/calendar";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, Plus } from "lucide-react";
import { dateKey, statusLabel, timeLabel } from "../../services/format";

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 60;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i,
);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeeklyCalendar({
  bookings = [],
  weekStart,
  status = "",
  role = "applicant",
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
      <div className="gcal-body-scroll" ref={timetableScrollRef}>
        <div className="gcal-timetable">
          {/* Header and timetable share one horizontal scroll position. */}
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
                    className={`gcal-day-header-cell ${isToday ? "is-today" : ""}`}
                    onClick={() =>
                      onSelectDate && onSelectDate(dateKey(dayDate))
                    }
                    title="Click to view daily list for this date"
                  >
                    <span className="gcal-day-name">{DAY_NAMES[idx]}</span>
                    <span
                      className={`gcal-day-num ${isToday ? "is-today" : ""}`}
                    >
                      {dayDate.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable Timetable with Hour Axis and 7 Day Columns */}
          <div className="gcal-body-grid">
            {/* Time labels axis */}
            <div className="gcal-time-column">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="gcal-hour-label"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span>{formatDisplayTime(hour, 0)}</span>
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
                    className={`gcal-day-column ${isToday ? "is-today" : ""}`}
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
                      const slot1End =
                        hour === 23 ? "23:59" : formatTimeSlot(hour + 1, 0);
                      const slot1Url = `/${role}/book?date=${dKey}&start_time=${slot1Start}&end_time=${slot1End}`;

                      // Slot 2: :30
                      const isSlot2Past =
                        isPastDate ||
                        (isTodayDate &&
                          (nowObj.hour > hour ||
                            (nowObj.hour === hour && nowObj.minute >= 30)));
                      const slot2Start = formatTimeSlot(hour, 30);
                      const slot2End =
                        hour === 23 ? "23:59" : formatTimeSlot(hour + 1, 30);
                      const slot2Url = `/${role}/book?date=${dKey}&start_time=${slot2Start}&end_time=${slot2End}`;

                      return (
                        <div
                          key={hour}
                          className="gcal-hour-cell"
                          style={{ height: `${HOUR_HEIGHT}px` }}
                        >
                          <Link
                            to={slot1Url}
                            className={`gcal-book-slot slot-top ${isSlot1Past ? "is-past" : ""}`}
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
                            className={`gcal-book-slot slot-bottom ${isSlot2Past ? "is-past" : ""}`}
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
                          <span className="gcal-event-title">
                            {evt.purpose}
                          </span>
                          <span
                            className={`gcal-status-pill status-${evt.status}`}
                          >
                            {statusLabel(evt.status)}
                          </span>
                        </div>
                        <div className="gcal-event-time">
                          <Clock size={10} />
                          <span>
                            {timeLabel(evt.start_time)} –{" "}
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
    </div>
  );
}
