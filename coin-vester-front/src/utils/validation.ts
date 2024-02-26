import { Address } from '@massalabs/massa-web3';

export const validateAddress = (address: string) => {
  if (address.length === 0) {
    return 'Address is required';
  }
  try {
    new Address(address);
  } catch (e) {
    return `Invalid address: ${e}`;
  }
  return undefined;
};

export const validateDuration = (duration: string) => {
  if (duration.length === 0) {
    return 'Duration is required';
  }
  let durationInMS = BigInt(0);
  try {
    durationInMS = BigInt(duration);
  } catch (e) {
    return 'Invalid duration';
  }
  if (durationInMS < 0) {
    return 'Duration must be greater than 0';
  }

  return undefined;
};

export const validateStartTime = (value: string) => {
  if (value.length === 0) {
    return 'Start timestamp is required';
  }
  try {
    BigInt(value);
  } catch (e) {
    return 'Invalid timestamp';
  }
  if (isNaN(new Date(Number(value)).getTime())) {
    return 'Invalid timestamp';
  }

  return undefined;
};

export const validateTag = (value: string) => {
  if (value.length === 0) {
    return 'Tag is required';
  }
  const byteLength = new Blob([value]).size;
  if (byteLength > 127) {
    return 'Tag is too long';
  }
  return undefined;
};
