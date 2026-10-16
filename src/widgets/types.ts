import React from 'react';

export interface WidgetProps {
  onExpand?: () => void;
}

export interface IslandWidget {
  id: string;
  name: string;
  priority: number; // Higher number = higher priority
  idleView?: React.FC<WidgetProps>;
  peekView?: React.FC<WidgetProps>;
  expandedView?: React.FC<WidgetProps>;
}
