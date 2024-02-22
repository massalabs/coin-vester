interface CardProps {
  children: React.ReactNode;
  bgColor?: string;
}

export function Card(props: CardProps) {
  const { children, bgColor = 'bg-secondary' } = props;

  return (
    <div className={`${bgColor} border-none rounded-xl p-5`}>{children}</div>
  );
}
