import { ReactNode, HTMLAttributes } from 'react';
import styles from './Container.module.css';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'full';
  centered?: boolean;
  children: ReactNode;
}

export function Container({
  size = 'md',
  centered = true,
  children,
  className = '',
  ...props
}: ContainerProps) {
  const classNames = [
    styles.container,
    styles[size],
    centered ? styles.centered : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}
