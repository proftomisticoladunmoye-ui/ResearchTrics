import { coverGradient } from '@/lib/blog';

/**
 * A blog post's display picture. Uses a real cover image when one is provided,
 * otherwise a branded gradient tile with a document mark — so every post has a
 * consistent visual across the blog and the Discover sidebar.
 */
export function BlogCover({
  title,
  tone,
  image,
  className = '',
  rounded = 'rounded-lg',
}: {
  title: string;
  tone: string;
  image?: string | null;
  className?: string;
  rounded?: string;
}) {
  if (image) {
    return <img src={image} alt={title} className={`${rounded} object-cover ${className}`} />;
  }
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-gradient-to-br ${coverGradient(tone)} ${rounded} ${className}`}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
        <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M15 4v5h5M8 13h8M8 17h5" />
      </svg>
    </div>
  );
}
