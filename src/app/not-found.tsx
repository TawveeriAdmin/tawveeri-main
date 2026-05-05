import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '4rem', marginBottom: '0.5rem', color: '#0D47A1' }}>
        404
      </h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        الصفحة غير موجودة / Page Not Found
      </h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        <br />
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/ar"
        style={{
          padding: '0.75rem 2rem',
          backgroundColor: '#0D47A1',
          color: 'white',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontSize: '1rem',
        }}
      >
        العودة للرئيسية / Back to Home
      </Link>
    </div>
  );
}
