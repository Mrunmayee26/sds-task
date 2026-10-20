import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarPlus,
  Building2,
  Calendar,
  Users,
  CheckCircle2,
  FileText,
  Upload,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import ApplicantLayout from '../layouts/ApplicantLayout';
import { GradientButton } from '../components';
import {
  CURRENT_APPLICANT,
  getAllVenues,
  getVenueById,
  checkTimeslotConflict,
  createBooking,
} from '../services/bookingService';
import styles from './ApplicantBookVenue.module.css';

const EVENT_TYPES = [
  'Workshop',
  'Seminar',
  'Guest Lecture',
  'Hackathon / Coding Sprint',
  'Club Meeting',
  'Cultural Event',
  'Project Demonstration',
  'Other Academic Activity',
];

const AVAILABLE_EQUIPMENT = [
  'Projector & Screen',
  'Audio System & Microphones',
  'Air Conditioning',
  'High-speed Wi-Fi Access',
  'Whiteboard & Dry Erase Markers',
  'Lab Computer Access',
  'Podium & Stage Lighting',
  'Video Recording Setup',
];

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ApplicantBookVenue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const venues = useMemo(() => getAllVenues(), []);

  // Pre-fill venue if passed in URL query
  const queryVenue = searchParams.get('venue');

  const [formData, setFormData] = useState({
    eventName: '',
    eventType: 'Workshop',
    purpose: '',
    venue: queryVenue || (venues[0]?.name ?? 'Main Auditorium'),
    date: getTodayDateStr(),
    startTime: '10:00',
    endTime: '13:00',
    attendance: '40',
    equipment: ['Projector & Screen', 'High-speed Wi-Fi Access'],
    specialInstructions: '',
    applicantName: CURRENT_APPLICANT.name,
    department: CURRENT_APPLICANT.club,
    email: CURRENT_APPLICANT.email,
    phone: CURRENT_APPLICANT.phone,
    supportingDocument: null,
  });

  const [errors, setErrors] = useState({});
  const [submittedBooking, setSubmittedBooking] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevQueryVenue, setPrevQueryVenue] = useState(queryVenue);

  if (queryVenue !== prevQueryVenue) {
    setPrevQueryVenue(queryVenue);
    if (queryVenue) {
      setFormData((prev) => ({ ...prev, venue: queryVenue }));
    }
  }

  // Selected venue object details
  const selectedVenueObj = useMemo(() => {
    return getVenueById(formData.venue);
  }, [formData.venue]);

  // Live conflict detection
  const liveConflict = useMemo(() => {
    if (!formData.venue || !formData.date || !formData.startTime || !formData.endTime) {
      return null;
    }
    if (formData.startTime >= formData.endTime) {
      return { hasConflict: true, message: 'End time must be later than start time.' };
    }
    return checkTimeslotConflict(
      formData.venue,
      formData.date,
      formData.startTime,
      formData.endTime
    );
  }, [formData.venue, formData.date, formData.startTime, formData.endTime]);

  // Handle inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const toggleEquipment = (eq) => {
    setFormData((prev) => {
      const exists = prev.equipment.includes(eq);
      return {
        ...prev,
        equipment: exists
          ? prev.equipment.filter((item) => item !== eq)
          : [...prev.equipment, eq],
      };
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, supportingDocument: file.name }));
    }
  };

  // Form Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.eventName.trim()) {
      newErrors.eventName = 'Event title is mandatory.';
    }
    if (!formData.purpose.trim()) {
      newErrors.purpose = 'Please describe the event purpose & objective.';
    }
    if (!formData.date) {
      newErrors.date = 'Booking date is required.';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required.';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required.';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time.';
    }

    const attendanceNum = Number(formData.attendance);
    if (!formData.attendance || isNaN(attendanceNum) || attendanceNum <= 0) {
      newErrors.attendance = 'Enter valid attendance count.';
    } else if (selectedVenueObj && attendanceNum > selectedVenueObj.capacity) {
      newErrors.attendance = `Exceeds ${selectedVenueObj.name} capacity (${selectedVenueObj.capacity} seats).`;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      newErrors.email = 'Valid college email is required.';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Contact number is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }

    if (liveConflict?.hasConflict) {
      alert(`Cannot submit booking: ${liveConflict.message}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = createBooking(formData);
      setSubmittedBooking(created);
    } catch (err) {
      alert(`Booking submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ApplicantLayout>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.title}>Book a Campus Venue</h1>
          <p className={styles.subtitle}>
            Submit an official reservation request for academic rooms, computer labs, or seminar halls.
            Requests are reviewed and approved by Academic Affairs.
          </p>
        </header>

        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          {/* Section 1: Event Information */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <FileText size={18} className={styles.sectionIcon} />
              <h2 className={styles.sectionTitle}>1. Event Information</h2>
            </div>

            <div className={styles.fieldGrid2}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="eventName">
                  Event Name <span className={styles.required}>*</span>
                </label>
                <input
                  id="eventName"
                  name="eventName"
                  type="text"
                  placeholder="e.g. AI & Robotics National Symposium"
                  value={formData.eventName}
                  onChange={handleChange}
                  className={`${styles.inputField} ${errors.eventName ? styles.inputError : ''}`}
                />
                {errors.eventName && <span className={styles.errorText}>{errors.eventName}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="eventType">
                  Event Category <span className={styles.required}>*</span>
                </label>
                <select
                  id="eventType"
                  name="eventType"
                  value={formData.eventType}
                  onChange={handleChange}
                  className={styles.selectField}
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="purpose">
                  Event Purpose &amp; Description <span className={styles.required}>*</span>
                </label>
                <textarea
                  id="purpose"
                  name="purpose"
                  rows={3}
                  placeholder="Explain event agenda, target audience, and planned activities..."
                  value={formData.purpose}
                  onChange={handleChange}
                  className={`${styles.textareaField} ${errors.purpose ? styles.inputError : ''}`}
                />
                {errors.purpose && <span className={styles.errorText}>{errors.purpose}</span>}
              </div>
            </div>
          </div>

          {/* Section 2: Venue & Schedule */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Building2 size={18} className={styles.sectionIcon} />
              <h2 className={styles.sectionTitle}>2. Venue &amp; Schedule</h2>
            </div>

            <div className={styles.fieldGrid2}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="venue">
                  Select Facility / Classroom <span className={styles.required}>*</span>
                </label>
                <select
                  id="venue"
                  name="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  className={styles.selectField}
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name} (Cap: {v.capacity} • {v.building})
                    </option>
                  ))}
                </select>

                {selectedVenueObj && (
                  <div className={styles.venueCapacityHint}>
                    <Users size={13} />
                    Maximum Seating Capacity: {selectedVenueObj.capacity} seats ({selectedVenueObj.floor})
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="attendance">
                  Expected Attendees <span className={styles.required}>*</span>
                </label>
                <input
                  id="attendance"
                  name="attendance"
                  type="number"
                  min="1"
                  max={selectedVenueObj?.capacity || 1000}
                  placeholder="e.g. 50"
                  value={formData.attendance}
                  onChange={handleChange}
                  className={`${styles.inputField} ${errors.attendance ? styles.inputError : ''}`}
                />
                {errors.attendance && <span className={styles.errorText}>{errors.attendance}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="date">
                  Booking Date <span className={styles.required}>*</span>
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  min={getTodayDateStr()}
                  value={formData.date}
                  onChange={handleChange}
                  className={`${styles.inputField} ${errors.date ? styles.inputError : ''}`}
                />
                {errors.date && <span className={styles.errorText}>{errors.date}</span>}
              </div>

              <div className={styles.fieldGrid2} style={{ gap: 12 }}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="startTime">
                    Start Time <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="startTime"
                    name="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={handleChange}
                    className={`${styles.inputField} ${errors.startTime ? styles.inputError : ''}`}
                  />
                  {errors.startTime && <span className={styles.errorText}>{errors.startTime}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="endTime">
                    End Time <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="endTime"
                    name="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={handleChange}
                    className={`${styles.inputField} ${errors.endTime ? styles.inputError : ''}`}
                  />
                  {errors.endTime && <span className={styles.errorText}>{errors.endTime}</span>}
                </div>
              </div>

              {/* Live Conflict Alert Banner */}
              <div className={styles.fullWidth}>
                {liveConflict?.hasConflict ? (
                  <div className={styles.conflictAlert} role="alert">
                    <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Reservation Conflict Warning:</strong>
                      <div>{liveConflict.message}</div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.availSuccess}>
                    <CheckCircle2 size={16} />
                    <span>Venue schedule is clear for this selected date and timeslot.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Applicant Details */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Users size={18} className={styles.sectionIcon} />
              <h2 className={styles.sectionTitle}>3. Applicant &amp; Organization Details</h2>
            </div>

            <div className={styles.fieldGrid2}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="applicantName">
                  Applicant Name
                </label>
                <input
                  id="applicantName"
                  name="applicantName"
                  type="text"
                  value={formData.applicantName}
                  disabled
                  className={styles.inputField}
                  style={{ background: '#F3F2F8', cursor: 'not-allowed' }}
                />
                <span className={styles.helperText}>Logged in as COEP Student Club Lead</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="department">
                  Department / Student Club <span className={styles.required}>*</span>
                </label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  value={formData.department}
                  onChange={handleChange}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="email">
                  Official College Email <span className={styles.required}>*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`${styles.inputField} ${errors.email ? styles.inputError : ''}`}
                />
                {errors.email && <span className={styles.errorText}>{errors.email}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="phone">
                  Contact Mobile Number <span className={styles.required}>*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`${styles.inputField} ${errors.phone ? styles.inputError : ''}`}
                />
                {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
              </div>
            </div>
          </div>

          {/* Section 4: Equipment & Attachments */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <Calendar size={18} className={styles.sectionIcon} />
              <h2 className={styles.sectionTitle}>4. Required Equipment &amp; Remarks</h2>
            </div>

            <div className={styles.formGroup}>
              <span className={styles.label}>Select Necessary Facilities:</span>
              <div className={styles.checkboxGrid}>
                {AVAILABLE_EQUIPMENT.map((item) => {
                  const checked = formData.equipment.includes(item);
                  return (
                    <label
                      key={item}
                      className={`${styles.checkLabel} ${checked ? styles.checkLabelActive : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEquipment(item)}
                        className={styles.customCheckbox}
                      />
                      {item}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="specialInstructions">
                Special Technical Instructions / Key Collection Notes
              </label>
              <input
                id="specialInstructions"
                name="specialInstructions"
                type="text"
                placeholder="e.g. Need lab in-charge presence for 3D printer calibration; 2 wireless handheld mics..."
                value={formData.specialInstructions}
                onChange={handleChange}
                className={styles.inputField}
              />
            </div>

            {/* Optional Document Upload */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Supporting Document (Optional Event Approval / Flyer)
              </label>
              <label className={styles.uploadDropzone}>
                <Upload size={22} className={styles.uploadIcon} />
                <span className={styles.uploadText}>
                  Click or drag file to attach event brochure / proposal PDF
                </span>
                <span className={styles.uploadSubtext}>Supported formats: PDF, PNG, DOCX (Max 5MB)</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.docx"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {formData.supportingDocument && (
                <div className={styles.filePreviewPill}>
                  <FileText size={14} />
                  <span>{formData.supportingDocument}</span>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={() => setFormData((prev) => ({ ...prev, supportingDocument: null }))}
                    aria-label="Remove attached document"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className={styles.formActionsRow}>
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => {
                if (window.confirm('Reset this booking form?')) {
                  navigate('/applicant/venues');
                }
              }}
            >
              Cancel
            </button>

            <GradientButton
              type="submit"
              size="lg"
              variant="solid"
              disabled={isSubmitting || liveConflict?.hasConflict}
            >
              <CalendarPlus size={18} style={{ marginRight: 8 }} />
              {isSubmitting ? 'Submitting Request...' : 'Submit Booking Request'}
            </GradientButton>
          </div>
        </form>

        {/* Confirmation Modal */}
        {submittedBooking && (
          <div
            className={styles.successModalBackdrop}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-title"
          >
            <div className={styles.successModalCard}>
              <div className={styles.successIconCircle}>
                <CheckCircle2 size={36} />
              </div>

              <h2 id="success-modal-title" className={styles.successTitle}>
                Booking Request Submitted!
              </h2>

              <p className={styles.successDesc}>
                Your reservation request for <strong>{submittedBooking.eventName}</strong> has been
                successfully created. It has been routed to Academic Affairs with a status of{' '}
                <strong>Pending</strong>.
              </p>

              <div className={styles.receiptBox}>
                <div className={styles.receiptRow}>
                  <span>Booking Reference ID:</span>
                  <strong>{submittedBooking.id}</strong>
                </div>
                <div className={styles.receiptRow}>
                  <span>Venue:</span>
                  <strong>{submittedBooking.venue}</strong>
                </div>
                <div className={styles.receiptRow}>
                  <span>Date &amp; Slot:</span>
                  <strong>
                    {submittedBooking.date} ({submittedBooking.startTime} - {submittedBooking.endTime})
                  </strong>
                </div>
                <div className={styles.receiptRow}>
                  <span>Applicant:</span>
                  <strong>{submittedBooking.applicant.name} ({submittedBooking.applicant.department})</strong>
                </div>
                <div className={styles.receiptRow}>
                  <span>Current Status:</span>
                  <strong style={{ color: '#D97706' }}>Pending Review</strong>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.resetBtn}
                  onClick={() => {
                    setSubmittedBooking(null);
                    setFormData((prev) => ({
                      ...prev,
                      eventName: '',
                      purpose: '',
                      supportingDocument: null,
                    }));
                  }}
                >
                  Book Another Venue
                </button>

                <GradientButton
                  size="md"
                  variant="solid"
                  onClick={() => navigate('/applicant/applications')}
                >
                  View My Applications
                  <ArrowRight size={15} style={{ marginLeft: 6 }} />
                </GradientButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </ApplicantLayout>
  );
}
