type TableChildrenProps = {
  children: React.ReactNode;
};

// The wrapper scrolls sideways on small screens instead of breaking the page.
export function Table({ children }: TableChildrenProps) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="text-text w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: TableChildrenProps) {
  return <thead className="bg-surface text-text-muted">{children}</thead>;
}

export function TableBody({ children }: TableChildrenProps) {
  return <tbody className="divide-border divide-y">{children}</tbody>;
}

export function TableRow({ children }: TableChildrenProps) {
  return <tr>{children}</tr>;
}

export function TableHeaderCell({ children }: TableChildrenProps) {
  return (
    <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">
      {children}
    </th>
  );
}

export function TableCell({ children }: TableChildrenProps) {
  return <td className="px-4 py-3 align-middle">{children}</td>;
}
