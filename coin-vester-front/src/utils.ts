import { toMAS } from "@massalabs/massa-web3";

export function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function msToTime(duration: number) {
  let days = Math.floor((duration / (1000 * 60 * 60 * 24)) % 30.44),
    months = Math.floor((duration / (1000 * 60 * 60 * 24 * 30.44)) % 12),
    years = Math.floor(duration / (1000 * 60 * 60 * 24 * 365.25));

  return `${years} Years, ${months} Months, ${days} Days`;
}

export function fromnMAS(nMAS: bigint) {
  return toMAS(nMAS) + " MAS";
}
