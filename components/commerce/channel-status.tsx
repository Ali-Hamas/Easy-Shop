import { MessageCircle, Camera, Globe, Minus } from "lucide-react";
export function ChannelStatus() {
  return (
    <div className="channel-list">
      {[
        { name: "Facebook Messenger", Icon: MessageCircle },
        { name: "Instagram", Icon: Camera },
        { name: "Storefront", Icon: Globe },
      ].map(({ name, Icon }) => (
        <div className="channel-row" key={name}>
          <span className="channel-icon">
            <Icon size={18} />
          </span>
          <span>{name}</span>
          <span className="channel-state">
            <Minus size={12} /> Not connected
          </span>
        </div>
      ))}
    </div>
  );
}
