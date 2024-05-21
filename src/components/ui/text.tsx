// components/ui/text.tsx
import React from 'react';

type TextProps = {
  variant?: 'h1' | 'h2' | 'h3' | 'p';
  children: React.ReactNode;
};

export const Text: React.FC<TextProps> = ({ variant = 'p', children }) => {
  const Component = variant;
  return <Component>{children}</Component>;
};
