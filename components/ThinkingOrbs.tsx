interface ThinkingOrbsProps {
    label?: string;
}

const ThinkingOrbs: React.FC<ThinkingOrbsProps> = ({ label }) => {
    return (
        <div className="flex items-center gap-[6px] mt-1.5">
            <span
                className="w-[9px] h-[9px] rounded-full"
                style={{
                    background: '#c4f20d',
                    boxShadow: '0 0 10px rgba(196,242,13,.8)',
                    animation: 'orb-bob 1.4s ease-in-out infinite',
                }}
            />
            <span
                className="w-[9px] h-[9px] rounded-full"
                style={{
                    background: '#7877ff',
                    boxShadow: '0 0 10px rgba(120,119,255,.8)',
                    animation: 'orb-bob 1.4s ease-in-out 0.18s infinite',
                }}
            />
            <span
                className="w-[9px] h-[9px] rounded-full"
                style={{
                    background: '#22d3ee',
                    boxShadow: '0 0 10px rgba(34,211,238,.8)',
                    animation: 'orb-bob 1.4s ease-in-out 0.36s infinite',
                }}
            />
            {label && (
                <span className="ml-2 text-xs text-neutral-400 font-display">{label}</span>
            )}
        </div>
    );
};

export default ThinkingOrbs;
