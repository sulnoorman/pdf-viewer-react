import styles from './DocumentStatus.module.css'

/**
 * Loading and failure states for the document area.
 *
 * Before these existed, a slow download showed an empty dark panel and a bad URL or a
 * corrupt file showed the same empty dark panel forever — indistinguishable, with the
 * reason only visible in the console.
 */

export function LoadingState({ label }) {
  return (
    <div className={styles.state} role="status">
      <div className={styles.skeleton} />
      <p className={styles.hint}>{label}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry, label, retryLabel }) {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.title}>{label}</p>
      {error?.message && <p className={styles.hint}>{error.message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className={styles.retry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ label }) {
  return (
    <div className={styles.state}>
      <p className={styles.hint}>{label}</p>
    </div>
  )
}
