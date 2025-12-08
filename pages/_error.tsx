import { NextPageContext } from 'next';

interface ErrorProps {
  statusCode: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: '4rem', margin: 0, color: '#666' }}>
        {statusCode}
      </h1>
      <p style={{ marginTop: '1rem', color: '#666' }}>
        {statusCode === 404
          ? 'Page not found'
          : 'An error occurred'}
      </p>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode: statusCode ?? 500 };
};

export default Error;
