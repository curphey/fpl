import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VirtualizedDataTable } from "../virtualized-data-table";
import type { Column } from "../data-table";

interface TestItem {
  id: number;
  name: string;
  value: number;
}

const columns: Column<TestItem>[] = [
  {
    key: "id",
    header: "ID",
    render: (item) => <span>{item.id}</span>,
  },
  {
    key: "name",
    header: "Name",
    render: (item) => <span>{item.name}</span>,
  },
  {
    key: "value",
    header: "Value",
    render: (item) => <span>{item.value}</span>,
  },
];

const generateData = (count: number): TestItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    value: (i + 1) * 10,
  }));

describe("VirtualizedDataTable", () => {
  it("renders without virtualization for small datasets", () => {
    const data = generateData(5);
    render(
      <VirtualizedDataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => item.id}
      />,
    );

    // All 5 items should be visible
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
    expect(screen.getByText("Item 4")).toBeInTheDocument();
    expect(screen.getByText("Item 5")).toBeInTheDocument();
  });

  it("renders headers correctly", () => {
    const data = generateData(3);
    render(
      <VirtualizedDataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => item.id}
      />,
    );

    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("renders with custom rowHeight", () => {
    const data = generateData(3);
    render(
      <VirtualizedDataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => item.id}
        rowHeight={60}
      />,
    );

    expect(screen.getByText("Item 1")).toBeInTheDocument();
  });

  it("renders with custom maxHeight", () => {
    const data = generateData(3);
    render(
      <VirtualizedDataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => item.id}
        maxHeight={400}
      />,
    );

    expect(screen.getByText("Item 1")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const data = generateData(3);
    const { container } = render(
      <VirtualizedDataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => item.id}
        className="custom-class"
      />,
    );

    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("renders empty state correctly", () => {
    render(
      <VirtualizedDataTable
        columns={columns}
        data={[]}
        keyExtractor={(item) => item.id}
      />,
    );

    // Headers should still be visible
    expect(screen.getByText("ID")).toBeInTheDocument();
    // No rows should be rendered
    expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  });

  it("uses keyExtractor correctly", () => {
    const data = generateData(3);
    const { container } = render(
      <VirtualizedDataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => `key-${item.id}`}
      />,
    );

    // Table should render without errors
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("applies column className correctly", () => {
    const columnsWithClass: Column<TestItem>[] = [
      {
        key: "id",
        header: "ID",
        className: "test-column-class",
        render: (item) => <span>{item.id}</span>,
      },
    ];

    const data = generateData(2);
    const { container } = render(
      <VirtualizedDataTable
        columns={columnsWithClass}
        data={data}
        keyExtractor={(item) => item.id}
      />,
    );

    expect(container.querySelector(".test-column-class")).toBeInTheDocument();
  });

  it("renders with virtualization for large datasets", () => {
    // Create a dataset larger than maxHeight / rowHeight
    const data = generateData(50);
    const { container } = render(
      <VirtualizedDataTable
        columns={columns}
        data={data}
        keyExtractor={(item) => item.id}
        rowHeight={44}
        maxHeight={300}
      />,
    );

    // Should have overflow-y-auto for virtualized scrolling
    const scrollContainer = container.querySelector(".overflow-y-auto");
    expect(scrollContainer).toBeInTheDocument();
  });
});
