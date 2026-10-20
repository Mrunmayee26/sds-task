import { useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Building2, MapPin, Users, Search, X, CalendarDays, Wifi, Projector, Snowflake, Check } from 'lucide-react';
import { StatusBadge } from '../components';
import ApproverLayout from '../layouts/ApproverLayout';
import { COEP_VENUES, VENUE_CATEGORIES } from '../data/venues.js';
import { SAMPLE_VENUE_BOOKINGS, SAMPLE_VENUE_STATUS_BY_ID } from '../data/demo/approverVenues.js';
import styles from './ApproverVenues.module.css';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

const AVAILABILITY = ['All statuses', 'Available', 'In Use', 'Unavailable', 'Not provided'];
const ALL_VENUE_CATEGORIES = 'All Categories';

const FacilityIcon = ({ facility }) => {
  const value = facility.toLowerCase();
  if (value.includes('projector')) return <Projector size={14} aria-hidden="true" />;
  if (value.includes('air conditioning')) return <Snowflake size={14} aria-hidden="true" />;
  if (value.includes('wi-fi')) return <Wifi size={14} aria-hidden="true" />;
  return <Check size={14} aria-hidden="true" />;
};
FacilityIcon.propTypes = { facility: PropTypes.string.isRequired };

export default function ApproverVenues({ venues }) {
  const isSampleData = venues === undefined;
  const venueData = useMemo(() => (venues === undefined
    ? COEP_VENUES.map((venue) => ({
      ...venue,
      status: SAMPLE_VENUE_STATUS_BY_ID[venue.id] || 'Not provided',
      bookings: SAMPLE_VENUE_BOOKINGS[venue.id] || [],
    }))
    : venues), [venues]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL_VENUE_CATEGORIES);
  const [availabilityFilter, setAvailabilityFilter] = useState('All statuses');
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
  const categoryOptions = useMemo(() => [ALL_VENUE_CATEGORIES, ...new Set([
    ...VENUE_CATEGORIES.filter((category) => category !== ALL_VENUE_CATEGORIES),
    ...venueData.map((venue) => venue.category).filter(Boolean),
  ])], [venueData]);

  const visibleVenues = useMemo(() => {
    const term = query.trim().toLowerCase();
    return venueData.filter((venue) => {
      const matchesQuery = !term || [venue.name, venue.location, venue.category]
        .some((value) => String(value || '').toLowerCase().includes(term));
      const matchesType = typeFilter === ALL_VENUE_CATEGORIES || venue.category === typeFilter;
      const matchesAvailability = availabilityFilter === 'All statuses'
        || (availabilityFilter === 'Not provided' ? !AVAILABILITY.slice(1, 4).includes(venue.status) : venue.status === availabilityFilter);
      return matchesQuery && matchesType && matchesAvailability;
    });
  }, [venueData, query, typeFilter, availabilityFilter]);

  const selectedVenue = venueData.find((venue) => venue.id === selectedId);

  useAccessibleDialog(Boolean(selectedVenue), {
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    triggerRef,
    onClose: () => setSelectedId(null),
  });

  const openDetails = (venue, event) => {
    triggerRef.current = event.currentTarget;
    setSelectedId(venue.id);
  };

  const clearFilters = () => {
    setQuery('');
    setTypeFilter(ALL_VENUE_CATEGORIES);
    setAvailabilityFilter('All statuses');
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
            <div><h2 id="venue-list-title">Campus venues</h2><p>{isSampleData ? 'Availability and bookings shown are sample development data.' : 'Venue specifications and availability provided to this page.'}</p></div>
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
                {categoryOptions.map((type) => <option key={type}>{type}</option>)}
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
              <h3>{venueData.length ? 'No venues found' : 'No venue data available'}</h3>
              <p>{venueData.length ? 'Try a different search or clear your filters to see all venues.' : 'No venues were provided to this page.'}</p>
              <button type="button" className={styles.clearButton} onClick={clearFilters}>Clear search and filters</button>
            </div>
          ) : (
            <div className={styles.venueGrid}>
              {visibleVenues.map((venue) => (
                <article className={styles.venueCard} key={venue.id}>
                  <button type="button" className={styles.cardSurface} onClick={(event) => openDetails(venue, event)} aria-label={`View details for ${venue.name}`}>
                    <div className={styles.cardTopline}><span className={styles.typeTag}>{venue.category}</span><StatusBadge status={venue.status || 'Not provided'} size="sm" /></div>
                    <h3>{venue.name}</h3>
                    <p className={styles.location}><MapPin size={14} aria-hidden="true" />{venue.location || 'Location details not available'}</p>
                    <div className={styles.capacity}><Users size={15} aria-hidden="true" /><span>Capacity</span><strong>{typeof venue.capacity === 'number' ? `${venue.capacity} people` : 'Details not available'}</strong></div>
                    <div className={styles.facilityList} aria-label="Facilities">
                      {venue.amenities?.length ? venue.amenities.slice(0, 4).map((facility) => <span key={facility}><FacilityIcon facility={facility} />{facility}</span>) : <small>Details not available</small>}
                      {(venue.amenities?.length || 0) > 4 && <small>+{venue.amenities.length - 4} more</small>}
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
              <div className={styles.detailLocation}><MapPin size={16} aria-hidden="true" /><div><strong>{selectedVenue.location || 'Location details not available'}</strong><span>{selectedVenue.name}</span></div></div>
              <div className={styles.detailMeta}>
                <div><span>Capacity</span><strong>{typeof selectedVenue.capacity === 'number' ? `${selectedVenue.capacity} people` : 'Details not available'}</strong></div>
                <div><span>Venue type</span><strong>{selectedVenue.category}</strong></div>
              </div>
              <section className={styles.detailSection}>
                <h3>Description</h3>
                <p className={styles.noBookings}>{selectedVenue.description || 'Details not available'}</p>
              </section>
              <section className={styles.detailSection}>
                <h3>Availability</h3>
                {isSampleData && <p className={styles.sampleNote}>Sample status for development preview</p>}
                <StatusBadge status={selectedVenue.status || 'Not provided'} size="sm" />
              </section>
              <section className={styles.detailSection}>
                <h3>Facilities</h3>
                {selectedVenue.amenities?.length ? <div className={styles.detailFacilities}>{selectedVenue.amenities.map((facility) => <span key={facility}><FacilityIcon facility={facility} />{facility}</span>)}</div> : <p className={styles.noBookings}>Details not available</p>}
              </section>
              <section className={styles.detailSection}>
                <h3>Rules</h3>
                <p className={styles.noBookings}>{selectedVenue.rules || 'Details not available'}</p>
              </section>
              <section className={styles.detailSection}>
                <div className={styles.bookingHeading}><h3>Booking schedule</h3><span>Sample bookings</span></div>
                {!(selectedVenue.bookings || []).length ? (
                  <p className={styles.noBookings}>No sample bookings are listed for this venue.</p>
                ) : (
                  <ul className={styles.bookingList}>
                    {(selectedVenue.bookings || []).map((booking) => (
                      <li key={booking.id}>
                        <div className={styles.bookingDate}><CalendarDays size={14} aria-hidden="true" /><span>{booking.date}</span><time>{booking.startTime}–{booking.endTime}</time></div>
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
    category: PropTypes.string,
    location: PropTypes.string,
    capacity: PropTypes.number,
    amenities: PropTypes.arrayOf(PropTypes.string),
    description: PropTypes.string,
    rules: PropTypes.string,
    status: PropTypes.string,
    bookings: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      event: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
      startTime: PropTypes.string.isRequired,
      endTime: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })).isRequired,
  })),
};
