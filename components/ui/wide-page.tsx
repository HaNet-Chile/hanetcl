import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useSideNav } from '@/hooks/use-desktop-layout';

// The desktop layout of a page (a wide web window, beside the side
// navigation). On the phone every piece here gives back the phone layout
// untouched, so a screen writes its layout once and only says what changes
// when there is room.

/** Measures of a wide page, the same on every screen (Home, ClassHall, the Hall). */
export const WIDE_PAGE = {
  /** A page with columns or a grid. */
  maxWidth: 1180,
  /** A page meant to be read top to bottom (a list, a form, a post). */
  readingWidth: 760,
  gutter: 32,
  top: 28,
  /** The narrow column beside the main one. */
  aside: 340,
  gap: 22,
  /** Below this content width two columns stack again (the icons-only rail on a small window). */
  columnsMinWidth: 900,
} as const;

export type WidePageSize = 'wide' | 'reading';

/** Whether this screen is drawn beside the side navigation (a wide web window). */
export function useWide() {
  return useSideNav().width > 0;
}

/**
 * The page's layout: whether it is wide, and whether there is room for two
 * columns (the icons-only rail between 768 and 1024 px leaves less).
 */
export function useWideLayout() {
  const { width } = useWindowDimensions();
  const side = useSideNav();
  const wide = side.width > 0;
  return { wide, columns: wide && width - side.width - WIDE_PAGE.gutter * 2 >= WIDE_PAGE.columnsMinWidth };
}

/**
 * Style for a page's scroll content: the phone's own on the phone, and on a
 * wide window a centered page with the desktop margins. Goes after the
 * phone's style, so it only overrides width, margins and the space on top.
 */
export function widePageStyle(wide: boolean, size: WidePageSize = 'wide'): StyleProp<ViewStyle> {
  if (!wide) return null;
  return size === 'reading' ? styles.reading : styles.page;
}

type ColumnsProps = {
  /** The main column (the one that grows). */
  main: React.ReactNode;
  /** The narrow column: a summary, actions or filters. Nothing (false or null) leaves the main column alone. */
  aside: React.ReactNode;
  /** The aside on the left instead of the right. */
  asideLeft?: boolean;
  /** On the phone (stacked), the aside goes first. */
  asideFirstOnPhone?: boolean;
  asideWidth?: number;
  /** Keeps the aside in view while the main column scrolls (web only). */
  stickyAside?: boolean;
  /** Extra style for both columns (their alignment or spacing), side by side only. */
  columnStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

/**
 * A main column and a narrow one side by side when there is room; stacked,
 * one after the other, on the phone and on a small window. Stacked, the two
 * parts sit straight in the page, so the page's own spacing applies.
 */
export function WideColumns({ main, aside, asideLeft, asideFirstOnPhone, asideWidth = WIDE_PAGE.aside, stickyAside, columnStyle, style }: ColumnsProps) {
  const { columns } = useWideLayout();
  // Without an aside (or without room) the main column is the page.
  if (!columns || !aside) {
    return asideFirstOnPhone ? <>{aside}{main}</> : <>{main}{aside}</>;
  }
  return (
    <View style={[styles.columns, asideLeft && styles.columnsReverse, style]}>
      <View style={[styles.main, columnStyle]}>{main}</View>
      <View style={[styles.aside, { width: asideWidth }, columnStyle, stickyAside && styles.sticky]}>{aside}</View>
    </View>
  );
}

type GridProps = {
  children: React.ReactNode;
  /** Columns on a wide window. */
  columns: number;
  /** Columns on the phone; 1 leaves the children as they are. */
  phoneColumns?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cards in rows of equal columns. Rows, rather than wrapping, so every card
 * of a row is as tall as the tallest and the last row keeps the same widths.
 * With one column (the phone) the cards stay straight in the page.
 */
export function WideGrid({ children, columns, phoneColumns = 1, gap = WIDE_PAGE.gap, style }: GridProps) {
  const { wide, columns: roomy } = useWideLayout();
  const count = wide ? (roomy ? columns : Math.min(columns, 2)) : phoneColumns;
  const items = React.Children.toArray(children).filter(Boolean);
  // On the phone the cards stay straight in the page, as they were.
  if (count <= 1) return <>{items}</>;
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += count) rows.push(items.slice(i, i + count));
  return (
    <View style={[{ gap }, style]}>
      {rows.map((row, index) => (
        <View key={index} style={[styles.row, { gap }]}>
          {row.map((item, column) => <View key={column} style={styles.cell}>{item}</View>)}
          {Array.from({ length: count - row.length }, (_, column) => <View key={`empty-${column}`} style={styles.cell} />)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    maxWidth: WIDE_PAGE.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: WIDE_PAGE.gutter,
    paddingTop: WIDE_PAGE.top,
  },
  reading: {
    width: '100%',
    maxWidth: WIDE_PAGE.readingWidth,
    alignSelf: 'center',
    paddingHorizontal: WIDE_PAGE.gutter,
    paddingTop: WIDE_PAGE.top,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: WIDE_PAGE.gap,
  },
  columnsReverse: {
    flexDirection: 'row-reverse',
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: WIDE_PAGE.gap,
  },
  aside: {
    gap: WIDE_PAGE.gap,
  },
  // react-native-web passes it through to CSS.
  sticky: {
    position: 'sticky' as 'relative',
    top: WIDE_PAGE.top,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});
