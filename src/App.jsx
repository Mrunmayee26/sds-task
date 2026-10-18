import { useState } from 'react';
import {
  Sidebar,
  GradientButton,
  VenueCard,
  StatusBadge,
  FormInput,
  FormSelect,
} from './components';
import {
  Search,
  ChevronDown,
  Bell,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './App.css';

export default function App() {
  const [activeNav, setActiveNav] = useState('book-venue');
  const [eventName, setEventName] = useState('');
  const [clubDept, setClubDept] = useState('');
  const [selectedTimelineSlot, setSelectedTimelineSlot] = useState('10:00');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'book-venue', label: 'Book a Venue' },
    { id: 'my-requests', label: 'My Requests' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'settings', label: 'Settings' },
  ];

  const clubsList = [
    'Cultural Committee',
    'Robotics & AI Club',
    'ACM Student Chapter',
    'Literary & Debate Society',
    'Music & Drama Club',
  ];

  return (
    <div className="app-layout">
      {/* 1. Reusable Sidebar Component */}
      <Sidebar
        items={navItems}
        activeId={activeNav}
        onSelect={(id) => setActiveNav(id)}
      />

      {/* Main Workspace Area */}
      <main className="main-content">
        {/* Top Header */}
        <header className="content-header">
          <h1 className="page-title">Book a Venue</h1>
          <div className="user-profile-actions">
            <button className="icon-badge-btn" aria-label="Notifications" type="button">
              <Bell size={20} />
              <span className="notif-dot">2</span>
            </button>
            <div className="avatar-wrapper">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                alt="User Profile"
                className="user-avatar"
              />
            </div>
          </div>
        </header>

        {/* Center Canvas / Columns */}
        <div className="workspace-grid">
          {/* Left / Middle: Venues Listing & Search */}
          <div className="venues-column">
            {/* Search Banner with Gradient Accent */}
            <div className="search-banner">
              <div className="search-input-pill">
                <input
                  type="text"
                  placeholder="Search Venues/Buildings..."
                  className="search-field"
                  aria-label="Search Venues"
                />
                <button type="button" className="search-icon-btn" aria-label="Submit Search">
                  <Search size={18} />
                </button>
              </div>

              <div className="filter-chips-row">
                <button type="button" className="filter-chip">
                  <span>Any Date</span>
                  <ChevronDown size={14} />
                </button>
                <button type="button" className="filter-chip">
                  <span>Equipped With</span>
                  <ChevronDown size={14} />
                </button>
                <button type="button" className="filter-chip">
                  <span>Capacity</span>
                  <ChevronDown size={14} />
                </button>
                <button type="button" className="filter-chip">
                  <span>Filter by Type</span>
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            {/* Venue Cards Showcase Grid */}
            <div className="venue-cards-grid">
              {/* Card 1: Main Auditorium */}
              <VenueCard
                title="Main Auditorium"
                capacity={500}
                amenities={['Wi-Fi', 'Stage', 'Audio']}
                extraContent={
                  <div className="preview-split">
                    <img
                      src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=300&auto=format&fit=crop&q=80"
                      alt="Auditorium Seating"
                      className="preview-img"
                    />
                    <div className="mini-cal-card">
                      <div className="mini-cal-header">
                        <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                      </div>
                      <div className="mini-cal-grid">
                        <span>1</span><span>2</span><span>3</span><span>4</span>
                        <span className="cal-dot-active">6</span><span>7</span><span>8</span><span>9</span>
                        <span>13</span><span>14</span><span>15</span><span>16</span>
                      </div>
                    </div>
                  </div>
                }
                buttonVariant="solid"
                buttonText="Book Now"
              />

              {/* Card 2: Seminar Hall B */}
              <VenueCard
                image="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&auto=format&fit=crop&q=80"
                imageAlt="Seminar Hall presentation setup"
                title="Seminar Hall B"
                capacity={120}
                amenities={['Wi-Fi', 'AC', 'Projector']}
                buttonSlot={
                  <GradientButton variant="outline" fullWidth>
                    Book Now
                  </GradientButton>
                }
              />

              {/* Card 3: CS Lab 3 */}
              <VenueCard
                image="https://images.unsplash.com/photo-1562774053-701939374585?w=400&auto=format&fit=crop&q=80"
                imageAlt="Computer Lab workstations"
                title="CS Lab 3"
                capacity={60}
                amenities={['Wi-Fi', 'AC', 'PC Lab']}
                extraContent={
                  <div className="lab-calendar-box">
                    <div className="lab-month-header">
                      <button type="button" className="cal-arrow-btn" aria-label="Previous Month">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="cal-month-name">Month</span>
                      <button type="button" className="cal-arrow-btn" aria-label="Next Month">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="cal-week-labels">
                      <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
                    </div>
                    <div className="cal-days-grid">
                      <span className="day-booked">1</span>
                      <span className="day-booked">2</span>
                      <span className="day-booked">3</span>
                      <span className="day-active-purple">4</span>
                      <span>5</span><span>6</span>
                      <span className="day-active-purple">7</span>
                      <span>8</span><span>9</span><span>10</span>
                      <span className="day-active-purple">11</span>
                      <span>12</span><span>13</span>
                    </div>
                  </div>
                }
                buttonVariant="solid"
                buttonText="Book Now"
              />
            </div>
          </div>

          {/* Right Panel: Reservation Details */}
          <aside className="reservation-panel">
            <div className="panel-header">
              <h2 className="panel-title">Reservation Details</h2>
              <button type="button" className="panel-more-btn" aria-label="Reservation Options">
                <MoreHorizontal size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="panel-tabs">
              <button type="button" className="tab-btn active">
                Active timeline {selectedTimelineSlot && `(${selectedTimelineSlot})`}
              </button>
              <button type="button" className="tab-btn">
                Booked vs free
              </button>
            </div>

            {/* Timeline Matrix */}
            <div className="timeline-container">
              <div className="timeline-header-hours">
                <span>03</span>
                <span>10</span>
                <span>11</span>
                <span>12</span>
              </div>

              <div className="timeline-rows">
                <div
                  className="timeline-row"
                  onClick={() => setSelectedTimelineSlot('10:00')}
                >
                  <span className="time-label">10:00</span>
                  <div className="time-slot-track">
                    <StatusBadge status="Booked" className="timeline-badge-long" />
                  </div>
                </div>

                <div
                  className="timeline-row"
                  onClick={() => setSelectedTimelineSlot('18:30')}
                >
                  <span className="time-label">18:30</span>
                  <div className="time-slot-track">
                    <StatusBadge status="Booked" className="timeline-badge-medium" />
                  </div>
                </div>

                <div
                  className="timeline-row"
                  onClick={() => setSelectedTimelineSlot('19:30')}
                >
                  <span className="time-label">19:30</span>
                  <div className="time-slot-track justify-right">
                    <StatusBadge status="Free" className="timeline-badge-medium" />
                  </div>
                </div>

                <div
                  className="timeline-row"
                  onClick={() => setSelectedTimelineSlot('20:00')}
                >
                  <span className="time-label">20:00</span>
                  <div className="time-slot-track">
                    <StatusBadge status="Booked" className="timeline-badge-short" />
                  </div>
                </div>

                <div className="timeline-row muted">
                  <span className="time-label">22:30</span>
                  <div className="time-slot-track empty-track"></div>
                </div>
              </div>
            </div>

            {/* Form Inputs matching mockup */}
            <form className="booking-form" onSubmit={(e) => e.preventDefault()}>
              <FormInput
                label="Event Name"
                name="eventName"
                placeholder="Event Name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
              />

              <FormSelect
                label="Club/Dept"
                name="clubDept"
                placeholder="Club/Dept"
                value={clubDept}
                onChange={(e) => setClubDept(e.target.value)}
                options={clubsList}
                required
              />

              <GradientButton
                type="submit"
                variant="solid"
                size="lg"
                fullWidth
                onClick={() => {
                  if (!eventName) {
                    alert('Please enter an event name!');
                  } else {
                    alert(`Reservation requested for "${eventName}"!`);
                  }
                }}
              >
                Confirm Booking
              </GradientButton>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
