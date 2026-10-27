import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("card__head", className)}>
      <div style={{ minWidth: 0 }}>
        {title && <h2>{title}</h2>}
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="row row-tight" style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  flush = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cn(flush ? "" : "card__body", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card__foot", className)} {...props} />;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("section-head", className)}>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row row-tight">{actions}</div>}
    </div>
  );
}
