const AmbientAurora = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div
                className="absolute w-[340px] h-[340px] rounded-full"
                style={{
                    left: '10%',
                    top: '20%',
                    background: 'radial-gradient(circle, rgba(196,242,13,.7), transparent 65%)',
                    filter: 'blur(40px)',
                    opacity: 0.05,
                    animation: 'ambient-drift-1 14s ease-in-out infinite',
                }}
            />
            <div
                className="absolute w-[300px] h-[300px] rounded-full"
                style={{
                    right: '5%',
                    top: '10%',
                    background: 'radial-gradient(circle, rgba(120,119,255,.6), transparent 65%)',
                    filter: 'blur(40px)',
                    opacity: 0.05,
                    animation: 'ambient-drift-2 15s ease-in-out infinite',
                }}
            />
            <div
                className="absolute w-[260px] h-[260px] rounded-full"
                style={{
                    left: '40%',
                    bottom: 0,
                    background: 'radial-gradient(circle, rgba(34,211,238,.5), transparent 65%)',
                    filter: 'blur(40px)',
                    opacity: 0.05,
                    animation: 'ambient-drift-3 12s ease-in-out infinite',
                }}
            />
        </div>
    );
};

export default AmbientAurora;
