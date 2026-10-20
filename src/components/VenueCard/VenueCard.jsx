import PropTypes from 'prop-types';
import {
  Users,
  Wifi,
  Wind,
  Tv,
  Mic,
  Volume2,
  Laptop,
  SquarePen,
  CheckCircle2,
} from 'lucide-react';
import GradientButton from '../GradientButton/GradientButton';
import styles from './VenueCard.module.css';

/**
 * Maps common amenity labels to appropriate Lucide icons
 */
const getAmenityIcon = (name) => {
  const normalized = String(name || '').toLowerCase().trim();
  if (normalized.includes('wifi') || normalized.includes('wi-fi') || normalized.includes('internet')) {
    return <Wifi size={16} />;
  }
  if (normalized.includes('ac') || normalized.includes('air') || normalized.includes('climate')) {
    return <Wind size={16} />;
  }
  if (normalized.includes('projector') || normalized.includes('screen') || normalized.includes('display')) {
    return <Tv size={16} />;
  }
  if (normalized.includes('stage') || normalized.includes('podium') || normalized.includes('mic')) {
    return <Mic size={16} />;
  }
  if (normalized.includes('sound') || normalized.includes('audio') || normalized.includes('speaker')) {
    return <Volume2 size={16} />;
  }
  if (normalized.includes('board') || normalized.includes('whiteboard')) {
    return <SquarePen size={16} />;
  }
  if (normalized.includes('lab') || normalized.includes('pc') || normalized.includes('computer')) {
    return <Laptop size={16} />;
  }
  return <CheckCircle2 size={16} />;
};

/**
 * VenueCard - White display card for rooms and event halls.
 * Includes top media/image section, title & capacity, amenities row, and button slot.
 */
const VenueCard = ({
  image,
  imageAlt,
  title,
  capacity,
  amenities = [],
  buttonSlot,
  buttonText = 'Book Now',
  buttonVariant = 'solid',
  onButtonClick,
  extraContent,
  badge,
  className = '',
  ...rest
}) => {
  return (
    <article className={`${styles.card} ${className}`.trim()} {...rest}>
      {/* Top Media / Hero Section */}
      <div className={styles.topSection}>
        {badge && <div className={styles.badgeOverlay}>{badge}</div>}

        {image ? (
          <div className={styles.mediaContainer}>
            {typeof image === 'string' ? (
              <img
                src={image}
                alt={imageAlt || title}
                className={styles.image}
                loading="lazy"
              />
            ) : (
              image
            )}
          </div>
        ) : (
          <div className={styles.gradientHero}>
            <span className={styles.heroTitle}>{title}</span>
            {capacity && (
              <span className={styles.heroCapacity}>
                <Users size={14} /> Capacity: {capacity}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className={styles.body}>
        {/* Title & Capacity Header */}
        <div className={styles.headerInfo}>
          <h3 className={styles.title}>{title}</h3>
          {capacity && (
            <div className={styles.capacityRow}>
              <Users size={15} className={styles.capacityIcon} />
              <span>Capacity: {capacity}</span>
            </div>
          )}
        </div>

        {/* Middle Section: Amenities */}
        {amenities && amenities.length > 0 && (
          <div className={styles.amenitiesSection} aria-label="Available amenities">
            {amenities.map((item, index) => (
              <div key={`${item}-${index}`} className={styles.amenityItem}>
                <div className={styles.amenityIconWrapper}>
                  {getAmenityIcon(item)}
                </div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Optional Extra Content (e.g. mini calendar, photo gallery) */}
        {extraContent && (
          <div className={styles.extraContent}>
            {extraContent}
          </div>
        )}

        {/* Bottom Section: Button Slot */}
        <div className={styles.bottomSection}>
          {buttonSlot ? (
            buttonSlot
          ) : (
            <GradientButton
              variant={buttonVariant}
              onClick={onButtonClick}
              fullWidth
            >
              {buttonText}
            </GradientButton>
          )}
        </div>
      </div>
    </article>
  );
};

VenueCard.propTypes = {
  /** Image URL string or custom ReactNode for the top section */
  image: PropTypes.node,
  /** Alt text for the image */
  imageAlt: PropTypes.string,
  /** Title of the venue (e.g. 'Main Auditorium') */
  title: PropTypes.string.isRequired,
  /** Room capacity (e.g. 500 or '500') */
  capacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** List of amenity names like ['Wi-Fi', 'AC', 'Projector'] mapped to icons */
  amenities: PropTypes.arrayOf(PropTypes.string),
  /** Slot for a custom button element (solid or outlined GradientButton) */
  buttonSlot: PropTypes.node,
  /** Default button text if buttonSlot is not provided */
  buttonText: PropTypes.string,
  /** Default button variant ('solid' or 'outline') if buttonSlot is not provided */
  buttonVariant: PropTypes.oneOf(['solid', 'outline']),
  /** Callback fired when default button is clicked */
  onButtonClick: PropTypes.func,
  /** Additional custom content inside card body (calendar preview, thumbnails, etc.) */
  extraContent: PropTypes.node,
  /** Optional badge in top-right of image (e.g. StatusBadge) */
  badge: PropTypes.node,
  /** Optional extra CSS class */
  className: PropTypes.string,
};

export default VenueCard;
