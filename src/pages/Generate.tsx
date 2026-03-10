import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { generateAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Upload, 
  Image as ImageIcon, 
  Images, 
  Wand2, 
  Download,
  X,
  Sparkles,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';

const PROVIDERS = [
  { id: 'zhenzhen', name: '贞贞的AI工坊', url: 'https://ai.t8star.cn' },
  { id: 'sillydream', name: 'SillyDream', url: 'https://wish.sillydream.top' },
];

const MODELS = [
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image' },
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image' },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
];

const SIZES = [
  { id: '1K', name: '1K (1024px)', width: 1024 },
  { id: '2K', name: '2K (2048px)', width: 2048 },
];

const ASPECT_RATIOS = [
  { id: '1:1', name: '1:1 正方形', value: '1:1' },
  { id: '16:9', name: '16:9 宽屏', value: '16:9' },
  { id: '9:16', name: '9:16 竖屏', value: '9:16' },
  { id: '4:3', name: '4:3 标准', value: '4:3' },
  { id: '3:4', name: '3:4 肖像', value: '3:4' },
  { id: '21:9', name: '21:9 超宽', value: '21:9' },
];

export default function Generate() {
  useAuth(); // 确保用户已登录
  const [mode, setMode] = useState<'text2img' | 'img2img' | 'multiImg'>('text2img');
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState('zhenzhen');
  const [model, setModel] = useState('gemini-3-pro-image-preview');
  const [size, setSize] = useState('1K');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过10MB');
      return;
    }

    try {
      toast.loading('正在上传图片...');
      const response = await generateAPI.uploadImage(file);
      toast.dismiss();
      
      const imageUrl = response.data.url;
      if (mode === 'img2img') {
        setReferenceImages([imageUrl]);
      } else if (mode === 'multiImg') {
        if (referenceImages.length >= 4) {
          toast.error('最多只能上传4张参考图');
          return;
        }
        setReferenceImages([...referenceImages, imageUrl]);
      }
      toast.success('图片上传成功');
    } catch (err) {
      toast.dismiss();
      toast.error('图片上传失败');
    }
  }, [mode, referenceImages]);

  const removeReferenceImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    if ((mode === 'img2img' || mode === 'multiImg') && referenceImages.length === 0) {
      setError('请上传参考图片');
      return;
    }

    setError('');
    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const response = await generateAPI.generate({
        prompt,
        provider,
        model,
        size,
        aspectRatio,
        mode,
        referenceImages: mode === 'text2img' ? undefined : referenceImages,
      });

      const { imageUrl, imageBase64 } = response.data;
      setGeneratedImage(imageUrl || imageBase64);
      toast.success('图像生成成功！');
    } catch (err: any) {
      setError(err.response?.data?.error || '图像生成失败，请重试');
      toast.error('图像生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `generated-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('图片下载中...');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：控制面板 */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* 生成模式 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  生成模式
                </Label>
                <Tabs value={mode} onValueChange={(v) => {
                  setMode(v as any);
                  setReferenceImages([]);
                  setGeneratedImage(null);
                }}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text2img" className="flex items-center gap-1">
                      <Wand2 className="w-3 h-3" />
                      文生图
                    </TabsTrigger>
                    <TabsTrigger value="img2img" className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      图生图
                    </TabsTrigger>
                    <TabsTrigger value="multiImg" className="flex items-center gap-1">
                      <Images className="w-3 h-3" />
                      多图参考
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* API供应商 */}
              <div className="space-y-2">
                <Label>API 供应商</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 模型选择 */}
              <div className="space-y-2">
                <Label>模型</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 分辨率 */}
              <div className="space-y-2">
                <Label>分辨率</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 宽高比 */}
              <div className="space-y-2">
                <Label>宽高比</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 参考图片上传 */}
          {(mode === 'img2img' || mode === 'multiImg') && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Label className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {mode === 'img2img' ? '上传参考图片' : '上传参考图片 (最多4张)'}
                </Label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mode === 'multiImg' && referenceImages.length >= 4}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  选择图片
                </Button>

                {/* 已上传图片预览 */}
                {referenceImages.length > 0 && (
                  <div className={`grid gap-2 ${mode === 'multiImg' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {referenceImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`参考图 ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeReferenceImage(index)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：生成区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 提示词输入 */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                提示词
              </Label>
              <Textarea
                placeholder={
                  mode === 'text2img'
                    ? '描述您想要生成的图像，例如：一张美丽的日落海景图，金色的阳光洒在海面上...'
                    : mode === 'img2img'
                    ? '描述您想要对参考图进行的修改，例如：将这张图片转换成动漫风格...'
                    : '描述您想要生成的图像，参考上传的图片风格...'
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-5 w-5" />
                    开始生成
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 生成结果 */}
          {generatedImage && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">生成结果</h3>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                </div>
                <div className="rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={generatedImage}
                    alt="生成的图像"
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 空状态 */}
          {!generatedImage && !isGenerating && (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-violet-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  准备好开始创作了吗？
                </h3>
                <p className="text-gray-500">
                  输入提示词，选择参数，点击生成按钮开始您的AI创作之旅
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
