import { useState } from "react";
import Collapsible from "react-collapsible";

import { vestingSessionType } from "../types/types";

import "./SessionCard.css";
import { fromMAS } from "@massalabs/massa-web3";
import { formatAddress, fromnMAS, msToDateWithTimeZone, msToTime } from "../utils";

import { ReactComponent as MassaWalletIcon } from "../assets/massa_wallet.svg";
import { ReactComponent as BearbyWalletIcon } from "../assets/bearby_wallet.svg";

type Props = {
  vestingSession: vestingSessionType;
  accountName?: string;
  accountProvider?: "MASSASTATION" | "BEARBY";
  handleClaim: (vestingID: bigint, amount: bigint) => void;
  handleDelete: (vestingID: bigint) => void;
};

function VestingSessionCard(props: Props) {
  const { vestingSession, accountName, accountProvider } = props;
  const [amountToClaim, setAmountToClaim] = useState("");
  const { vestingInfo, availableAmount, claimedAmount } = vestingSession;
  const [error, setError] = useState<string | null>(null);

  if (!vestingInfo) return null;

  const {
    toAddr,
    startTimestamp,
    linearDuration,
    cliffDuration,
    initialReleaseAmount,
    tag,
  } = vestingInfo;

  const checkValidAmount = (amount: string): string | null => {
    if (amount === "") return "Please enter a value";
    try {
      const masAmount = fromMAS(amount);
      if (amount.includes(".") && amount.split(".")[1].length > 9) {
        return "The amount can't have a precision greater than 9";
      }
      if (masAmount < BigInt(0)) {
        return "Please enter a positive number";
      }
      if (masAmount === BigInt(0)) {
        return "Please enter a non-zero number";
      }
      if (masAmount > availableAmount) {
        return "You can't claim more than the available amount";
      }
      return null;
    } catch (e) {
      if (e instanceof Error) {
        console.error("Error parsing amount: ", e);
        return `Please enter a valid MAS value`;
      }
      return "An unexpected error occurred";
    }
  };

  const handleClaim = () => {
    const error = checkValidAmount(amountToClaim);
    if (error) {
      setError(error);
      return;
    }

    try {
      const amount = fromMAS(amountToClaim);
      props.handleClaim(vestingSession.id, amount);
    } catch (e) {
      if (e instanceof Error) {
        setError(`Please enter a valid MAS value: ${e.message}`);
        return;
      }
    }
  };

  const handleDelete = () => {
    props.handleDelete(vestingSession.id);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountToClaim(e.target.value);
    const error = checkValidAmount(e.target.value);
    setError(error);
  };

  return (
    <div className="vesting-session-card">
      <div className="header">
        <div className="avatar-container">
          {accountProvider === "BEARBY" ? (
            <BearbyWalletIcon className="avatar" />
          ) : accountProvider === "MASSASTATION" ? (
            <MassaWalletIcon className="avatar" />
          ) : null}
          <h3 style={{ marginLeft: "8px" }}>
            {accountName ? accountName : "Account"} -{" "}
            {formatAddress(toAddr.base58Encode)}
          </h3>
        </div>
        <span className="tag">{tag}</span>
      </div>
      <div className="total-amount">
        Total amount: {fromnMAS(vestingInfo.totalAmount)}
      </div>
      <div className="claimable-amount">
        Available to Claim: {fromnMAS(availableAmount)}
      </div>
      <div className="action-container">
        {claimedAmount !== vestingInfo.totalAmount && (
          <div className="input-container">
            <div className="input-claim-container">
              <input
                type="text"
                placeholder="Amount to claim"
                value={amountToClaim}
                onChange={handleAmountChange}
              />
              <button onClick={handleClaim} disabled={!!error}>
                Claim
              </button>
            </div>
            {error && (
              <div className="error-container">
                <p className="error">{error}</p>
              </div>
            )}
          </div>
        )}
        {claimedAmount === vestingInfo.totalAmount && (
          <button onClick={handleDelete}>Delete</button>
        )}
      </div>
      <hr />
      <Collapsible trigger="More infos">
        <div className="more-info-items">
          <span title="The date at which the vesting starts.">
            <i className="fa fa-info-circle" /> Start Date
          </span>
          <div className="info-content">
            <b>{msToDateWithTimeZone(Number(startTimestamp))}</b>
            <div className="raw-value">{startTimestamp.toString()} ms</div>
          </div>
        </div>
        <div className="more-info-items">
          <span title="The amount of MAS that is released at the start date.">
            <i className="fa fa-info-circle" /> Initial Release
          </span>
          <b>{fromnMAS(initialReleaseAmount)}</b>
        </div>
        <div className="more-info-items">
          <span title="The duration after which the linear release starts, starting from the start date.">
            <i className="fa fa-info-circle" /> Cliff Duration
          </span>
          <div className="info-content">
            <b>{msToTime(Number(cliffDuration))}</b>
            <div className="raw-value">{cliffDuration.toString()} ms</div>
          </div>
        </div>
        <div className="more-info-items">
          <span title="The duration over which the remaining amount is released, starting from the end of the cliff duration.">
            <i className="fa fa-info-circle" /> Linear Duration
          </span>
          <div className="info-content">
            <b>{msToTime(Number(linearDuration))}</b>
            <div className="raw-value">{linearDuration.toString()} ms</div>
          </div>
        </div>
        <div className="more-info-items">
          <span title="The amount of MAS that was already claimed.">
            <i className="fa fa-info-circle" /> Claimed Amount
          </span>
          <b>{fromnMAS(claimedAmount)}</b>
        </div>
      </Collapsible>
    </div>
  );
}

export default VestingSessionCard;
