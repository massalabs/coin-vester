import React, { useState } from 'react';

function CoinVester() {
  const [fundsData, setFundsData] = useState([
    {
      tag: 'tag1',
      totalAmount: '1235 MAS',
      startDateTime: '2024-01-01T12:00',
      initialRelease: '100 MAS',
      cliffEndDateTime: '2024-06-01T12:00',
      linearEndDateTime: '2025-01-01T12:00',
      claimed: '500 MAS',
      availableToClaim: '735 MAS',
    },
    {
      tag: 'tag2',
      totalAmount: '2000 MAS',
      startDateTime: '2024-02-01T12:00',
      initialRelease: '200 MAS',
      cliffEndDateTime: '2024-07-01T12:00',
      linearEndDateTime: '2025-02-01T12:00',
      claimed: '2000 MAS',
      availableToClaim: '0 MAS',
    },
  ]);

  const buttonStyle = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    outline: 'none',
    margin: '5px',
  };

  const deleteButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'red',
    color: 'white',
    marginTop: '10px',
    width: '10rem',
    padding: '10px 20px',
  };

  const handleClaim = (index: number) => {
    // Placeholder function for claim logic
  };

  const handleDelete = (index: number) => {
    // Placeholder function for delete logic
  };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      margin: '0 auto',
      padding: '20px',
      maxWidth: '800px',
      backgroundColor: '#f7f7f7',
      boxShadow: '0 4px 8px 0 rgba(0,0,0,0.2)',
      borderRadius: '10px',
    }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>Coin Vester</h1>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#555', marginBottom: '20px' }}>Claim Received Funds</h2>
        {fundsData.map((fund, index) => (
          <div key={index} style={{
            border: '1px solid #ddd',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '10px',
            backgroundColor: 'white',
            transition: 'box-shadow 0.3s',
            display: 'flex',
            flexDirection: 'column',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <span><strong>Tag:</strong> {fund.tag}</span>
            <span><strong>Total Amount:</strong> {fund.totalAmount}</span>
            <span><strong>Start Date:</strong> {fund.startDateTime}</span>
            <span><strong>Initial Release:</strong> {fund.initialRelease}</span>
            <span><strong>Cliff End Date:</strong> {fund.cliffEndDateTime}</span>
            <span><strong>Linear End Date:</strong> {fund.linearEndDateTime}</span>
            <span><strong>Claimed:</strong> {fund.claimed}</span>
            <span><strong>Available to Claim:</strong> {fund.availableToClaim}</span>
            {parseFloat(fund.availableToClaim) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                <input
                  type="number"
                  style={{ 
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ddd',
                    marginRight: '5px',
                    WebkitAppearance: 'none', // Remove the slider for Webkit browsers
                    MozAppearance: 'textfield', // Remove the slider for Firefox
                  }}
                />
                <button 
                  style={{ ...buttonStyle, backgroundColor: '#4CAF50', color: 'white' }}
                  onClick={() => handleClaim(index)}
                >
                  Claim
                </button>
              </div>
            )}
            {parseFloat(fund.availableToClaim) === 0 && (
              <button
                style={deleteButtonStyle}
                onClick={() => handleDelete(index)}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 style={{ color: '#555' }}>Send Vested Funds</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <label style={{ marginBottom: '5px' }}>Tag:</label>
          <input type="text" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
          <label style={{ marginBottom: '5px' }}>Recipient Address:</label>
          <input type="text" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
          <label style={{ marginBottom: '5px' }}>Total Amount (MAS):</label>
          <input type="number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd', WebkitAppearance: 'none', MozAppearance: 'textfield' }} />
          <label style={{ marginBottom: '5px' }}>Start Time:</label>
          <input type="datetime-local" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
          <label style={{ marginBottom: '5px' }}>Start Release (MAS):</label>
          <input type="number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd', WebkitAppearance: 'none', MozAppearance: 'textfield' }} />
          <label style={{ marginBottom: '5px' }}>Cliff End:</label>
          <input type="datetime-local" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
          <label style={{ marginBottom: '5px' }}>Linear End:</label>
          <input type="datetime-local" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
          <button
            style={{ ...buttonStyle, backgroundColor: '#008CBA', color: 'white', width: '100%' }}
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

export default CoinVester;