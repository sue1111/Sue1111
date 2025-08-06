// Helper functions for formatting

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`
  }

  const days = Math.floor(hours / 24)
  if (days < 30) {
    return `${days} day${days !== 1 ? "s" : ""} ago`
  }

  const months = Math.floor(days / 30)
  if (months < 12) {
    return `${months} month${months !== 1 ? "s" : ""} ago`
  }

  const years = Math.floor(months / 12)
  return `${years} year${years !== 1 ? "s" : ""} ago`
}
