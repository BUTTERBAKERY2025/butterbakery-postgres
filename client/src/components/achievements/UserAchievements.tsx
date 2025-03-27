import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Award, Trophy, Star, CheckCircle2, 
  LightbulbIcon, Calendar, Target, Clock 
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { reshapeArabicText } from "@/lib/arabicTextUtils";

interface UserAchievementsProps {
  userId?: number;
}

export function UserAchievements({ userId }: UserAchievementsProps) {
  // استعلام عن إنجازات المستخدم
  const { 
    data: achievements, 
    isLoading,
    error
  } = useQuery({
    queryKey: ['/api/achievements/user', userId],
    queryFn: () => apiRequest<any>(`/api/achievements/user${userId ? `/${userId}` : '/me'}`, { method: 'GET' }),
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>الإنجازات</CardTitle>
          <CardDescription>جار تحميل البيانات...</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-slate-200 h-10 w-10"></div>
            <div className="flex-1 space-y-6 py-1">
              <div className="h-2 bg-slate-200 rounded"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                  <div className="h-2 bg-slate-200 rounded col-span-1"></div>
                </div>
                <div className="h-2 bg-slate-200 rounded"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>خطأ في تحميل البيانات</CardTitle>
          <CardDescription>حدث خطأ أثناء تحميل بيانات الإنجازات</CardDescription>
        </CardHeader>
        <CardContent>
          <p>يرجى المحاولة مرة أخرى لاحقًا.</p>
        </CardContent>
      </Card>
    );
  }
  
  // فرز الإنجازات: المكتملة أولاً ثم حسب نسبة التقدم
  const sortedAchievements = [...(achievements || [])].sort((a, b) => {
    // المكتملة أولاً
    if (a.isCompleted && !b.isCompleted) return -1;
    if (!a.isCompleted && b.isCompleted) return 1;
    
    // ثم حسب التقدم
    return b.progress - a.progress;
  });
  
  // تجميع الإنجازات حسب الفئة
  const groupedAchievements: Record<string, any[]> = {};
  sortedAchievements.forEach(achievement => {
    if (!groupedAchievements[achievement.category]) {
      groupedAchievements[achievement.category] = [];
    }
    groupedAchievements[achievement.category].push(achievement);
  });
  
  // الحصول على أيقونة الفئة
  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'sales':
        return <Target className="h-5 w-5 text-green-600" />;
      case 'attendance':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'quality':
        return <Star className="h-5 w-5 text-yellow-600" />;
      case 'customer_service':
        return <CheckCircle2 className="h-5 w-5 text-purple-600" />;
      case 'team_work':
        return <LightbulbIcon className="h-5 w-5 text-orange-600" />;
      default:
        return <Award className="h-5 w-5 text-slate-600" />;
    }
  };
  
  // الحصول على اسم الفئة بالعربية
  const getCategoryName = (category: string) => {
    switch(category) {
      case 'sales':
        return 'المبيعات';
      case 'attendance':
        return 'الحضور';
      case 'quality':
        return 'الجودة';
      case 'customer_service':
        return 'خدمة العملاء';
      case 'team_work':
        return 'العمل الجماعي';
      default:
        return category;
    }
  };
  
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            الإنجازات
          </CardTitle>
          <CardDescription>
            سجل الإنجازات والأهداف المحققة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <h3 className="text-sm font-medium text-slate-500 mb-1">إجمالي الإنجازات</h3>
              <p className="text-3xl font-bold text-primary">{achievements?.length || 0}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <h3 className="text-sm font-medium text-slate-500 mb-1">الإنجازات المكتملة</h3>
              <p className="text-3xl font-bold text-green-600">
                {achievements?.filter(a => a.isCompleted).length || 0}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <h3 className="text-sm font-medium text-slate-500 mb-1">قيد التقدم</h3>
              <p className="text-3xl font-bold text-blue-600">
                {achievements?.filter(a => !a.isCompleted).length || 0}
              </p>
            </div>
          </div>
          
          {Object.keys(groupedAchievements).length === 0 ? (
            <div className="text-center py-8">
              <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">لا توجد إنجازات متاحة حالياً</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAchievements).map(([category, categoryAchievements]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(category)}
                    <h3 className="text-lg font-medium">{getCategoryName(category)}</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {categoryAchievements.map(achievement => (
                      <Card key={achievement.id} className={`border ${achievement.isCompleted ? 'border-green-200 bg-green-50/50' : ''}`}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              {achievement.icon ? (
                                <span className="text-2xl">{achievement.icon}</span>
                              ) : (
                                <Award className="h-5 w-5 text-primary" />
                              )}
                              <CardTitle className="text-base">
                                {reshapeArabicText(achievement.name)}
                              </CardTitle>
                            </div>
                            {achievement.isCompleted && (
                              <Badge className="bg-green-100 text-green-800 ml-2">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> مكتمل
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            {reshapeArabicText(achievement.description)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span>التقدم</span>
                              <span className="font-medium">{achievement.progress}%</span>
                            </div>
                            <Progress 
                              value={achievement.progress} 
                              className={achievement.isCompleted ? "bg-green-100" : "bg-slate-100"}
                            />
                          </div>
                        </CardContent>
                        <CardFooter className="pt-1 text-xs text-slate-500 justify-between">
                          <div>
                            <span className="font-semibold">{achievement.pointsValue}</span> نقطة
                          </div>
                          {achievement.completedAt && (
                            <div className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              أُكمل في {formatDate(achievement.completedAt, 'short')}
                            </div>
                          )}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}