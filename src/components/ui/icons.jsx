// ===================================================================================
// 아이콘 — lucide 아이콘에 앱 기본 굵기(2)를 입혀 한 곳에서 내보낸다
// -----------------------------------------------------------------------------------
// 예전에는 App.jsx 맨 위에서 40개를 한 번에 import 하고 각각 감싸는 줄이 40줄 더
// 있었다. 파일을 나누면 그 40줄이 파일마다 복사된다. 여기 한 번만 둔다.
//
// props 를 뒤에 펼치는 순서가 중요하다 — 부르는 쪽에서 strokeWidth 를 지정하면
// 그쪽이 이긴다 (기본값이 덮어쓰지 않는다).
// ===================================================================================
import React from 'react';
import {
    Home as HomeRaw,
    Trophy as TrophyRaw,
    Map as MapRaw,
    Users as UsersRaw,
    Users2 as Users2Raw,
    User as UserRaw,
    X as XRaw,
    Loader2 as Loader2Raw,
    ArrowLeft as ArrowLeftRaw,
    ShieldCheck as ShieldCheckRaw,
    ShoppingBag as ShoppingBagRaw,
    MessageSquare as MessageSquareRaw,
    Search as SearchRaw,
    Bell as BellRaw,
    MapPin as MapPinRaw,
    Phone as PhoneRaw,
    Heart as HeartRaw,
    ChevronRight as ChevronRightRaw,
    ChevronDown as ChevronDownRaw,
    Plus as PlusRaw,
    Archive as ArchiveRaw,
    Lock as LockRaw,
    Edit3 as Edit3Raw,
    Clock as ClockRaw,
    AlertCircle as AlertCircleRaw,
    Calendar as CalendarRaw,
    BarChart2 as BarChart2Raw,
    CheckCircle as CheckCircleRaw,
    UserCheck as UserCheckRaw,
    UserPlus as UserPlusRaw,
    GripVertical as GripVerticalRaw,
    Share2 as Share2Raw,
    Copy as CopyRaw,
    FlaskConical as FlaskConicalRaw,
    Flame as FlameRaw,
    Zap as ZapRaw,
    ArrowUpRight as ArrowUpRightRaw,
    Activity as ActivityRaw,
    Star as StarRaw,
    Tag as TagRaw,
    Truck as TruckRaw,
    Timer as TimerRaw,
    Crown as CrownRaw,
    LogOut as LogOutRaw,
    Send as SendRaw,
    Instagram as InstagramRaw,
    Camera as CameraRaw,
    Download as DownloadRaw,
    Bug as BugRaw,
    Lightbulb as LightbulbRaw,
    HelpCircle as HelpCircleRaw,
    Sparkles as SparklesRaw,
    KeyRound as KeyRoundRaw,
    Link2 as Link2Raw,
    WifiOff as WifiOffRaw,
    ArrowUpDown as ArrowUpDownRaw,
    Navigation as NavigationRaw,
    PlusCircle as PlusCircleRaw,
    Trash2 as Trash2Raw,
    Eye as EyeRaw,
    EyeOff as EyeOffRaw,
    Undo2 as Undo2Raw,
    ShieldAlert as ShieldAlertRaw,
    QrCode as QrCodeRaw,
    BellRing as BellRingRaw,
} from 'lucide-react';

const wrap = (Icon) => {
    const Wrapped = (props) => <Icon strokeWidth={2} {...props} />;
    Wrapped.displayName = `Icon(${Icon.displayName || Icon.name || 'lucide'})`;
    return Wrapped;
};

export const Home = wrap(HomeRaw);
export const Trophy = wrap(TrophyRaw);
export const KokMapIcon = wrap(MapRaw);
export const Users = wrap(UsersRaw);
export const Users2 = wrap(Users2Raw);
export const User = wrap(UserRaw);
export const X = wrap(XRaw);
export const Loader2 = wrap(Loader2Raw);
export const ArrowLeft = wrap(ArrowLeftRaw);
export const ShieldCheck = wrap(ShieldCheckRaw);
export const ShoppingBag = wrap(ShoppingBagRaw);
export const MessageSquare = wrap(MessageSquareRaw);
export const Search = wrap(SearchRaw);
export const Bell = wrap(BellRaw);
export const MapPin = wrap(MapPinRaw);
export const Phone = wrap(PhoneRaw);
export const Heart = wrap(HeartRaw);
export const ChevronRight = wrap(ChevronRightRaw);
export const ChevronDown = wrap(ChevronDownRaw);
export const Plus = wrap(PlusRaw);
export const Archive = wrap(ArchiveRaw);
export const Lock = wrap(LockRaw);
export const Edit3 = wrap(Edit3Raw);
export const Clock = wrap(ClockRaw);
export const AlertCircle = wrap(AlertCircleRaw);
export const Calendar = wrap(CalendarRaw);
export const BarChart2 = wrap(BarChart2Raw);
export const CheckCircle = wrap(CheckCircleRaw);
export const UserCheck = wrap(UserCheckRaw);
export const UserPlus = wrap(UserPlusRaw);
export const GripVertical = wrap(GripVerticalRaw);
export const Share2 = wrap(Share2Raw);
export const Copy = wrap(CopyRaw);
export const FlaskConical = wrap(FlaskConicalRaw);
export const Flame = wrap(FlameRaw);
export const Zap = wrap(ZapRaw);
export const ArrowUpRight = wrap(ArrowUpRightRaw);
export const Activity = wrap(ActivityRaw);
export const Star = wrap(StarRaw);
export const Tag = wrap(TagRaw);
export const Truck = wrap(TruckRaw);
export const Timer = wrap(TimerRaw);
export const Crown = wrap(CrownRaw);
export const LogOut = wrap(LogOutRaw);
export const Send = wrap(SendRaw);
export const Instagram = wrap(InstagramRaw);
export const Camera = wrap(CameraRaw);
export const Download = wrap(DownloadRaw);
export const Bug = wrap(BugRaw);
export const Lightbulb = wrap(LightbulbRaw);
export const HelpCircle = wrap(HelpCircleRaw);
export const Sparkles = wrap(SparklesRaw);
export const KeyRound = wrap(KeyRoundRaw);
export const Link2 = wrap(Link2Raw);
export const WifiOff = wrap(WifiOffRaw);
export const ArrowUpDown = wrap(ArrowUpDownRaw);
export const Navigation = wrap(NavigationRaw);
export const PlusCircle = wrap(PlusCircleRaw);
export const Trash2 = wrap(Trash2Raw);
export const Eye = wrap(EyeRaw);
export const EyeOff = wrap(EyeOffRaw);
export const Undo2 = wrap(Undo2Raw);
export const ShieldAlert = wrap(ShieldAlertRaw);
export const QrCode = wrap(QrCodeRaw);
export const BellRing = wrap(BellRingRaw);

// 원본 아이콘도 몇 개는 그대로 필요하다 (배경 장식으로 얇게 그릴 때)
export { ZapRaw, FlameRaw, TrophyRaw, MapRaw, HomeRaw, XRaw, ChevronRightRaw, Edit3Raw, UsersRaw, ArchiveRaw };
