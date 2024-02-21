import { toMAS } from "@massalabs/massa-web3";
import moment from "moment-timezone";

export function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function msToTime(ms: number) {
  const duration = moment.duration(Number(ms));
  return `${duration.years()} years ${duration.months()} months ${duration.days()} days ${duration.hours()} hours ${duration.minutes()} minutes`;
}

// Formats the date in the local timezone YYYY-MM-DD followed by the time zone abbreviation
export function msToDateWithTimeZone(ms: number) {
  const date = moment(Number(ms)).local();

  const t = moment.tz.guess();
  const timeZone = moment.tz(t).zoneAbbr();

  return `${date.format("YYYY-MM-DD")} ${timeZone}`;
}

export function fromnMAS(nMAS: bigint) {
  return toMAS(nMAS).toFormat() + " MAS";
}
