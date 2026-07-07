import type { FC } from "react";
import Icon from "./Icon";
import CloseIcon from "../../assets/close.svg?react";

interface ModalCloseButtonProps {
  onClick: () => void;
}

const ModalCloseButton: FC<ModalCloseButtonProps> = ({ onClick }) => (
  <button
    type="button"
    className="modal-close-btn"
    onClick={onClick}
    aria-label="Close"
  >
    <Icon as={CloseIcon} title="Close" />
  </button>
);

export default ModalCloseButton;
