import { Building2 } from 'lucide-react';
import styles from './AuthBrandPanel.module.css';

export default function AuthBrandPanel() {
  return (
    <section className={styles.brandPanel} aria-label="VenueFlow introduction">
      <div className={styles.brandGlow} aria-hidden="true" />
      <div className={styles.brandContent}>
        <div className={styles.brandIdentity}>
          <span className={styles.brandIcon} aria-hidden="true"><Building2 size={23} /></span>
          <span className={styles.brandName}>VenueFlow</span>
        </div>
        <p className={styles.brandSubtitle}>CAMPUS SPACES</p>
        <span className={styles.brandTag}>SMARTER CAMPUS OPERATIONS</span>
        <div className={styles.brandMessage}>
          <p className={styles.brandOverline}>One campus, many possibilities</p>
          <h1>Every campus space, one simple system.</h1>
          <p className={styles.brandDescription}>Discover available venues, request bookings, avoid scheduling conflicts, and manage approvals from one place.</p>
        </div>
      </div>
      <footer className={styles.brandFooter}>COEP Technological University</footer>
    </section>
  );
}
