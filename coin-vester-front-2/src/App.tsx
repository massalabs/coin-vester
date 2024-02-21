import { useState } from 'react';
import { Button } from '@massalabs/react-ui-kit';

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <div className="theme-dark bg-primary">
        <a href="https://vitejs.dev" target="_blank"></a>
        <a href="https://react.dev" target="_blank"></a>
      </div>
      <h1 className="m-4">Vite + React</h1>
      <div className="mas-body">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <Button>Button</Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </>
  );
}

export default App;
