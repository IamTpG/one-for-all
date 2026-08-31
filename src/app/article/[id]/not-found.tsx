import Link from "next/link";
import styles from "./Article.module.css";

export default function ArticleNotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.loadingState}>
        <p>This item isn&apos;t in the current feed anymore.</p>
        <Link href="/">Back to feed</Link>
      </div>
    </div>
  );
}
