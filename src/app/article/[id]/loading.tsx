import styles from "./Article.module.css";

export default function ArticleLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.loadingState}>Loading article…</div>
    </div>
  );
}
