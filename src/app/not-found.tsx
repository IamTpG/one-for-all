import Link from "next/link";
import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <span className={`${styles.code} mono`}>404</span>
      <p className={`${styles.message} display`}>This page doesn&apos;t exist.</p>
      <Link href="/" className={styles.link}>
        Back to Wire
      </Link>
    </div>
  );
}
