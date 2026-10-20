import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  MapPin,
  Building,
  CalendarPlus,
  Info,
  X,
  Sparkles,
} from 'lucide-react';
import ApplicantLayout from '../layouts/ApplicantLayout';
import { GradientButton } from '../components';
import { getAllVenues } from '../services/bookingService';
import { VENUE_CATEGORIES } from '../data/venues.js';
import styles from './ApplicantVenues.module.css';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

export default function ApplicantVenues() {
  const navigate = useNavigate();
  const venues = useMemo(() => getAllVenues(), []);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [activeModalVenue, setActiveModalVenue] = useState(null);
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  const openDetails = (venue, event) => {
    triggerRef.current = event.currentTarget;
    setActiveModalVenue(venue);
  };

  useAccessibleDialog(Boolean(activeModalVenue), {
    containerRef: modalRef,
    initialFocusRef: closeButtonRef,
    triggerRef,
    onClose: () => setActiveModalVenue(null),
  });

  // Filtered venues (Search by venue name and filter by category)
  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      // Search by venue name
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matches = [v.name, v.category, v.location].some((value) => value.toLowerCase().includes(query));
        if (!matches) return false;
      }

      // Filter by category
      if (selectedCategory !== 'All Categories' && v.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [venues, search, selectedCategory]);

  const handleBookVenue = (venueName) => {
    navigate(`/applicant/book?venue=${encodeURIComponent(venueName)}`);
  };

  return (
    <ApplicantLayout>
      <div className={styles.page}>
        {/* Page Title & Count */}
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>Browse Campus Venues</h1>
            <p className={styles.subtitle}>
              Official COEP facilities including Main Auditorium, Mini Auditorium, North Complex (NC01–NC32),
              and South Complex (SC01–SC20).
            </p>
          </div>
          <span className={styles.venueCountBadge}>
            Showing {filteredVenues.length} of {venues.length} Facilities
          </span>
        </header>

        {/* Filter Toolbar: Search by Name and Filter by Category */}
        <section className={styles.filterCard} aria-label="Venue filters">
          <div className={styles.searchRow}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by venue name (e.g. NC01, SC15, Auditorium)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
                aria-label="Search venues by name"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.selectDropdown}
              aria-label="Filter by venue category"
            >
              {VENUE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Venues Grid */}
        <section className={styles.venuesGrid} aria-label="Available venues list">
          {filteredVenues.length === 0 ? (
            <div className={styles.emptyState}>
              <Sparkles size={36} color="#7047EB" />
              <h2 className={styles.emptyStateTitle}>No matching venues found</h2>
              <p className={styles.emptyStateDesc}>
                No official venue matched your search. You can search for classrooms such as NC01–NC32,
                SC01–SC20, Main Auditorium, or Mini Auditorium.
              </p>
              <button
                type="button"
                className={styles.detailsBtn}
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('All Categories');
                }}
              >
                Reset search
              </button>
            </div>
          ) : (
            filteredVenues.map((v) => (
              <article key={v.id} className={styles.venueCardItem}>
                {/* Visual Header */}
                <div className={styles.imageContainer}>
                  <div className={styles.gradientHero}>
                    <span className={styles.gradientHeroCode}>{v.name}</span>
                    <span className={styles.gradientHeroSub}>{v.category}</span>
                  </div>
                  <span className={styles.typeBadge}>{v.category}</span>
                </div>

                {/* Body */}
                <div className={styles.cardBody}>
                  <div className={styles.venueTitleRow}>
                    <h2 className={styles.venueName}>{v.name}</h2>
                    <span className={styles.capacityPill}>
                      <Users size={13} />
                      {typeof v.capacity === 'number'
                        ? `${v.capacity} seats`
                        : 'Details not available'}
                    </span>
                  </div>

                  <div className={styles.locationRow}>
                    <MapPin size={14} />
                    <span>{v.location || 'Details not available'}</span>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <strong style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                      EQUIPMENT:
                    </strong>
                    {v.amenities && v.amenities.length > 0 ? (
                      <div className={styles.amenitiesWrap}>
                        {v.amenities.map((am) => (
                          <span key={am} className={styles.amenityTag}>
                            {am}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.unconfiguredText}>Details not available</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className={styles.cardActions} style={{ marginTop: 'auto' }}>
                    <button
                      type="button"
                      className={styles.detailsBtn}
                      onClick={(event) => openDetails(v, event)}
                    >
                      <Info size={14} />
                      View Details
                    </button>

                    <button
                      type="button"
                      className={styles.bookBtn}
                      onClick={() => handleBookVenue(v.name)}
                    >
                      <CalendarPlus size={15} />
                      Book Facility
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Modal: Detailed Venue Specification */}
        {activeModalVenue && (
          <div
            className={styles.modalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="venue-modal-title"
          >
            <div ref={modalRef} className={styles.modalCard}>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setActiveModalVenue(null)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>

              <div className={styles.modalContent}>
                <div>
                  <h2 id="venue-modal-title" className={styles.modalTitle}>
                    {activeModalVenue.name}
                  </h2>
                  <div className={styles.modalMetaRow}>
                    <span className={styles.locationRow}>
                      <Building size={15} /> {activeModalVenue.location || 'Details not available'}
                    </span>
                    <span className={styles.typeBadge} style={{ position: 'static' }}>
                      {activeModalVenue.category}
                    </span>
                  </div>
                </div>

                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionHeading}>Seating Capacity</h3>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    {typeof activeModalVenue.capacity === 'number'
                      ? `${activeModalVenue.capacity} Seats`
                      : 'Details not available'}
                  </p>
                </div>

                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionHeading}>Equipped Amenities</h3>
                  {activeModalVenue.amenities && activeModalVenue.amenities.length > 0 ? (
                    <div className={styles.amenitiesWrap}>
                      {activeModalVenue.amenities.map((am) => (
                        <span key={am} className={styles.amenityTag}>
                          {am}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.unconfiguredText}>Details not available</p>
                  )}
                </div>

                <div className={styles.modalSection}>
                  <h3 className={styles.modalSectionHeading}>Facility Guidelines &amp; Rules</h3>
                  <p className={styles.unconfiguredText}>
                    {activeModalVenue.rules || 'Details not available'}
                  </p>
                </div>

                <div className={styles.modalFooterActions}>
                  <button
                    type="button"
                    className={styles.detailsBtn}
                    onClick={() => setActiveModalVenue(null)}
                  >
                    Close
                  </button>

                  <GradientButton
                    size="md"
                    variant="solid"
                    onClick={() => {
                      const name = activeModalVenue.name;
                      setActiveModalVenue(null);
                      handleBookVenue(name);
                    }}
                  >
                    <CalendarPlus size={16} style={{ marginRight: 6 }} />
                    Proceed to Reserve
                  </GradientButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ApplicantLayout>
  );
}
