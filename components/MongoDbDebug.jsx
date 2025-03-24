import { useState, useEffect } from 'react';

export default function MongoDbDebug() {
  const [status, setStatus] = useState({ loading: true, data: null, error: null });
  
  useEffect(() => {
    async function checkMongoDB() {
      try {
        // Create a dedicated endpoint for this check
        const response = await fetch('/api/debug/mongodb');
        const data = await response.json();
        
        setStatus({
          loading: false,
          data: data,
          error: null
        });
      } catch (err) {
        setStatus({
          loading: false,
          data: null,
          error: err.message
        });
      }
    }
    
    checkMongoDB();
  }, []);
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: '#f0f0f0',
      border: '1px solid #ddd',
      padding: '10px',
      borderRadius: '4px',
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '400px'
    }}>
      <h3>MongoDB Status</h3>
      
      {status.loading && <p>Checking MongoDB connection...</p>}
      
      {status.error && (
        <div style={{ color: 'red' }}>
          <p>Error: {status.error}</p>
        </div>
      )}
      
      {status.data && (
        <div>
          <p style={{ color: status.data.connected ? 'green' : 'red' }}>
            MongoDB: {status.data.connected ? 'Connected ✅' : 'Disconnected ❌'}
          </p>
          
          {status.data.sampleData && (
            <>
              <p>Sample Data: ({status.data.sampleData.length} items)</p>
              <pre style={{
                maxHeight: '200px',
                overflow: 'auto',
                background: '#f8f8f8',
                padding: '5px'
              }}>
                {JSON.stringify(status.data.sampleData, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}

      <button
        onClick={async () => {
          console.log('Testing MongoDB connection...');
          try {
            const res = await fetch('/api/tasks?userId=test123');
            const data = await res.json();
            console.log('MongoDB test result:', data);
            alert(JSON.stringify(data, null, 2));
          } catch (e) {
            console.error('Error:', e);
            alert('Error: ' + e.message);
          }
        }}
        style={{
          padding: '10px',
          background: '#4285f4',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        Test MongoDB Connection
      </button>
    </div>
  );
} 