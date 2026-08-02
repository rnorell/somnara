export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  label: string;
}
