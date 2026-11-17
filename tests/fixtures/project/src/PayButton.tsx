type Props = { active: boolean };

export function PayButton({ active }: Props) {
  return (
    <button className="bg-[#3B82F6] text-[#FFF] p-[15px]">
      {active ? "결제" : "대기"}
    </button>
  );
}
