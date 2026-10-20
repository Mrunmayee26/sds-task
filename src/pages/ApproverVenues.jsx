import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Building2, MapPin, Users, Search, X, CalendarDays, Wifi, Projector, Snowflake, Check } from 'lucide-react';
import { StatusBadge } from '../components';
import ApproverLayout from '../layouts/ApproverLayout';
import { SAMPLE_APPROVER_VENUES } from './sampleData/approverVenues.sample';
import styles from './ApproverVenues.module.css';

const VENUE_TYPES = ['Classroom', 'Seminar Hall', 'Auditorium', 'Laboratory'];
const AVAILABILITY = ['All', 'Available', 'In Use', 'Unavailable'];
const STATUS_CLASS = { Available: 'available', 'In Use': 'inUse', Unavailable: 'unavailable' };

const FacilityIcon = ({ facility }) => {
  const value = facility.toLowerCase();
  if (value.includes('projector')) return <Projector size={14} aria-hidden="true" />;
  if (value.includes('air conditioning')) return <Snowflake size={14} aria-hidden="true" />;
  if (value.includes('wi-fi')) return <Wifi size={14} aria-hidden="true" />;
  return <Check size={14} aria-hidden="true" />;
};
FacilityIcon.propTypes = { facility: PropTypes.string.isRequired };

const VenueStatus = ({ status }) => (
  <span className={`${styles.status} ${styles[STATUS_CLASS[status]] || ''}`}>
    <span aria-hidden="true" />{status}
  </span>
);
VenueStatus.propTypes = { status: PropTypes.string.isRequired };

export default function ApproverVenues({ venues }) {
  const venueData = venues === undefined ? SAMPLE_APPROVER_VENUES : venues;
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [availabilityFilter, setAvailabilityFilter] = useState('All');
  const [selectedId, setSelectedId] = useState(null);
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  const counts = useMemo(() => ({
    total: venueData.length,
    available: venueData.filter((venue) => venue.status === 'Available').length,
    inUse: venueData.filter((venue) => venue.status === 'In Use').length,
    unavailable: venueData.filter((venue) => venue.status === 'Unavailable').length,
  }), [venueData]);

  const visibleVenues = useMemo(() => {
    const term = query.trim().toLowerCase();
    return venueData.filter((venue) => {
      const matchesQuery = !term || [venue.name, venue.location, venue.building]
        .some((value) => String(value || '').toLowerCase().includes(term));
      const matchesType = typeFilter === 'All types' || venue.type === typeFilter;
      const matchesAvailability = availabilityFilter === 'All' || venue.status === availabilityFilter;
      return matchesQuery && matchesType && matchesAvailability;
    });
  }, [venueData, query, typeFilter, availabilityFilter]);

  const selectedVenue = venueData.find((venue) => venue.id === selectedId);

  useEffect(() => {
    if (!selectedVenue) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedId(null);
      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [selectedVenue]);

  const openDetails = (venue, event) => {
    triggerRef.current = event.currentTarget;
    setSelectedId(venue.id);
  };

  const clearFilters = () => {
    setQuery('');
    setTypeFilter('All types');
    setAvailabilityFilter('All');
  };

  return (
    <ApproverLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>CAMPUS SPACES</p>
            <h1 className={styles.title}>Venues</h1>
            <p className={styles.subtitle}>View campus venues and their availability.</p>
          </div>
          <div className={styles.headerIcon} aria-hidden="true"><Building2 size={22} /></div>
        </header>

        <section className={styles.summaryGrid} aria-label="Venue summary">
          <article className={styles.summaryCard}><span>Total Venues</span><strong>{counts.total}</strong></article>
          <article className={styles.summaryCard}><span>Available</span><strong>{counts.available}</strong></article>
          <article className={styles.summaryCard}><span>In Use</span><strong>{counts.inUse}</strong></article>
          <article className={styles.summaryCard}><span>Unavailable</span><strong>{counts.unavailable}</strong></article>
        </section>

        <section className={styles.venueSection} aria-labelledby="venue-list-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="venue-list-title">Campus venues</h2><p>Availability shown here is sample development data.</p></div>
            <span className={styles.resultCount}>{visibleVenues.length} {visibleVenues.length === 1 ? 'venue' : 'venues'}</span>
          </div>
          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <Search size={17} aria-hidden="true" />
              <span className={styles.visuallyHidden}>Search by venue name or location</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search venues or locations" />
            </label>
            <label className={styles.selectLabel}>
              <span className={styles.visuallyHidden}>Filter by venue type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option>All types</option>{VENUE_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className={styles.selectLabel}>
              <span className={styles.visuallyHidden}>Filter by availability</span>
              <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
                {AVAILABILITY.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>

          {visibleVenues.length === 0 ? (
            <div className={styles.emptyState}>
              <Search size={22} aria-hidden="true" />
              <h3>No venues found</h3>
              <p>Try a different search or clear your filters to see all venues.</p>
              <button type="button" className={styles.clearButton} onClick={clearFilters}>Clear search and filters</button>
            </div>
          ) : (
            <div className={styles.venueGrid}>
              {visibleVenues.map((venue) => (
                <article className={styles.venueCard} key={venue.id}>
                  <button type="button" className={styles.cardSurface} onClick={(event) => openDetails(venue, event)} aria-label={`View details for ${venue.name}`}>
                    <div className={styles.cardTopline}><span className={styles.typeTag}>{venue.type}</span><VenueStatus status={venue.status} /></div>
                    <h3>{venue.name}</h3>
                    <p className={styles.location}><MapPin size={14} aria-hidden="true" />{venue.building} · {venue.location}</p>
                    <div className={styles.capacity}><Users size={15} aria-hidden="true" /><span>Capacity</span><strong>{venue.capacity}</strong></div>
                    <div className={styles.facilityList} aria-label="Facilities">
                      {venue.facilities.slice(0, 4).map((facility) => <span key={facility}><FacilityIcon facility={facility} />{facility}</span>)}
                      {venue.facilities.length > 4 && <small>+{venue.facilities.length - 4} more</small>}
                    </div>
                  </button>
                  <div className={styles.cardFooter}>
                    <span className={styles.readOnlyNote}>Venue overview</span>
                    <button type="button" className={styles.detailsButton} onClick={(event) => openDetails(venue, event)}>View Details</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedVenue && (
        <div className={styles.drawerLayer}>
          <button type="button" className={styles.backdrop} aria-label="Close venue details" onClick={() => setSelectedId(null)} />
          <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="venue-detail-title">
            <div className={styles.drawerHeader}>
              <div><p className={styles.eyebrow}>VENUE DETAILS</p><h2 id="venue-detail-title">{selectedVenue.name}</h2></div>
              <button ref={closeButtonRef} type="button" className={styles.closeButton} onClick={() => setSelectedId(null)} aria-label="Close venue details"><X size={19} /></button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.detailLocation}><MapPin size={16} aria-hidden="true" /><div><strong>{selectedVenue.building}</strong><span>{selectedVenue.location}</span></div></div>
              <div className={styles.detailMeta}>
                <div><span>Capacity</span><strong>{selectedVenue.capacity} people</strong></div>
                <div><span>Venue type</span><strong>{selectedVenue.type}</strong></div>
              </div>
              <section className={styles.detailSection}>
                <h3>Availability</h3>
                <p className={styles.sampleNote}>Sample status for development preview</p>
                <VenueStatus status={selectedVenue.status} />
              </section>
              <section className={styles.detailSection}>
                <h3>Facilities</h3>
                <div className={styles.detailFacilities}>{selectedVenue.facilities.map((facility) => <span key={facility}><FacilityIcon facility={facility} />{facility}</span>)}</div>
              </section>
              <section className={styles.detailSection}>
                <div className={styles.bookingHeading}><h3>Booking schedule</h3><span>Sample bookings</span></div>
                {selectedVenue.bookings.length === 0 ? (
                  <p className={styles.noBookings}>No sample bookings are listed for this venue.</p>
                ) : (
                  <ul className={styles.bookingList}>
                    {selectedVenue.bookings.map((booking) => (
                      <li key={booking.id}>
                        <div className={styles.bookingDate}><CalendarDays size={14} aria-hidden="true" /><span>{booking.date}</span><time>{booking.time}</time></div>
                        <strong>{booking.event}</strong>
                        <StatusBadge status={booking.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </ApproverLayout>
  );
}

ApproverVenues.propTypes = {
  venues: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    building: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    capacity: PropTypes.number.isRequired,
    type: PropTypes.string.isRequired,
    facilities: PropTypes.arrayOf(PropTypes.string).isRequired,
    status: PropTypes.oneOf(AVAILABILITY.slice(1)).isRequired,
    bookings: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      event: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
      time: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })).isRequired,
  })),
};
