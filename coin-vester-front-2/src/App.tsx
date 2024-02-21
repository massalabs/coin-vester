import { useState } from 'react';
import { Button } from '@massalabs/react-ui-kit';
import Intl from './i18n/i18n';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="bg-primary text-f-primary">
      <h1 className="m-4 mas-banner">{Intl.t('title')}</h1>
      <div className="mas-body text-brand">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <Button>Button</Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </div>
  );
}

export default App;
