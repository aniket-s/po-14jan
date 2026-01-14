'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  Loader2,
  Mail,
  Edit,
  Trash2,
  Eye,
  Copy,
  Send,
  CheckCircle2,
  XCircle,
  Code,
} from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  category: z.string().min(1, 'Category is required'),
  variables: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

const previewSchema = z.object({
  variables: z.string().optional(),
});

const testSendSchema = z.object({
  email: z.string().email('Invalid email address'),
  variables: z.string().optional(),
});

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isTestSendDialogOpen, setIsTestSendDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
  });

  const previewForm = useForm({
    resolver: zodResolver(previewSchema),
  });

  const testSendForm = useForm({
    resolver: zodResolver(testSendSchema),
  });

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: EmailTemplate[] }>('/admin/email-templates');
      setTemplates(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get<{ data: string[] }>('/admin/email-templates/categories/all');
      setCategories(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreate = async (data: TemplateFormData) => {
    try {
      setSubmitting(true);
      const payload = {
        ...data,
        variables: data.variables ? data.variables.split(',').map(v => v.trim()) : [],
      };
      await api.post('/admin/email-templates', payload);
      await fetchTemplates();
      setIsCreateDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error('Failed to create template:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: TemplateFormData) => {
    if (!selectedTemplate) return;
    try {
      setSubmitting(true);
      const payload = {
        ...data,
        variables: data.variables ? data.variables.split(',').map(v => v.trim()) : [],
      };
      await api.put(`/admin/email-templates/${selectedTemplate.id}`, payload);
      await fetchTemplates();
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      form.reset();
    } catch (error) {
      console.error('Failed to update template:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      setSubmitting(true);
      await api.delete(`/admin/email-templates/${selectedTemplate.id}`);
      await fetchTemplates();
      setIsDeleteDialogOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      await api.post(`/admin/email-templates/${template.id}/duplicate`);
      await fetchTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      await api.post(`/admin/email-templates/${template.id}/toggle-active`);
      await fetchTemplates();
    } catch (error) {
      console.error('Failed to toggle template status:', error);
    }
  };

  const handlePreview = async (data: any) => {
    if (!selectedTemplate) return;
    try {
      setSubmitting(true);
      const variables = data.variables
        ? JSON.parse(data.variables)
        : {};
      const response = await api.post(`/admin/email-templates/${selectedTemplate.id}/preview`, {
        variables,
      });
      setPreviewHtml(response.data.preview || response.data.data?.preview || '');
    } catch (error) {
      console.error('Failed to preview template:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestSend = async (data: any) => {
    if (!selectedTemplate) return;
    try {
      setSubmitting(true);
      const variables = data.variables
        ? JSON.parse(data.variables)
        : {};
      await api.post(`/admin/email-templates/${selectedTemplate.id}/test-send`, {
        email: data.email,
        variables,
      });
      alert('Test email sent successfully!');
      setIsTestSendDialogOpen(false);
      testSendForm.reset();
    } catch (error) {
      console.error('Failed to send test email:', error);
      alert('Failed to send test email');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    form.reset({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category,
      variables: template.variables.join(', '),
    });
    setIsEditDialogOpen(true);
  };

  const openPreviewDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewHtml('');
    previewForm.reset({
      variables: JSON.stringify(
        template.variables.reduce((acc, v) => ({ ...acc, [v]: `{${v}}` }), {}),
        null,
        2
      ),
    });
    setIsPreviewDialogOpen(true);
  };

  const openTestSendDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    testSendForm.reset({
      email: '',
      variables: JSON.stringify(
        template.variables.reduce((acc, v) => ({ ...acc, [v]: `{${v}}` }), {}),
        null,
        2
      ),
    });
    setIsTestSendDialogOpen(true);
  };

  const openDeleteDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      invitations: 'bg-blue-100 text-blue-800',
      samples: 'bg-purple-100 text-purple-800',
      production: 'bg-green-100 text-green-800',
      quality: 'bg-yellow-100 text-yellow-800',
      shipments: 'bg-orange-100 text-orange-800',
      system: 'bg-gray-100 text-gray-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout
      requiredPermissions={['admin.email_templates.view', 'admin.settings.view']}
      requireAll={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Email Templates</h1>
            <p className="text-muted-foreground mt-1">
              Manage email templates for automated notifications
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.filter((t) => t.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.filter((t) => !t.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Code className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              {filteredTemplates.length} template(s) found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No templates found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="max-w-md truncate">{template.subject}</TableCell>
                        <TableCell>
                          <Badge className={getCategoryBadgeColor(template.category)}>
                            {template.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {template.variables.slice(0, 3).map((variable) => (
                              <Badge key={variable} variant="outline" className="text-xs">
                                {variable}
                              </Badge>
                            ))}
                            {template.variables.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.variables.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(template)}
                          >
                            {template.is_active ? (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPreviewDialog(template)}
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTestSendDialog(template)}
                              title="Test Send"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDuplicate(template)}
                              title="Duplicate"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(template)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(template)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Email Template</DialogTitle>
              <DialogDescription>
                Create a new email template with dynamic variables
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="e.g., sample_submitted"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={form.watch('category')}
                    onValueChange={(value) => form.setValue('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.category && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.category.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  {...form.register('subject')}
                  placeholder="e.g., Sample Submitted for {{po_number}}"
                />
                {form.formState.errors.subject && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.subject.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Email Body</Label>
                <RichTextEditor
                  value={form.watch('body') || ''}
                  onChange={(value) => form.setValue('body', value)}
                  placeholder="Start typing your email body... Use {{variables}} for dynamic content"
                />
                {form.formState.errors.body && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.body.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="variables">
                  Variables (comma-separated)
                </Label>
                <Input
                  id="variables"
                  {...form.register('variables')}
                  placeholder="e.g., user_name, po_number, sample_type"
                />
                <p className="text-xs text-muted-foreground">
                  Use these variables in your template with double curly braces: {'{'}{'{'} variable_name {'}'}{'}'}
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Template
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Email Template</DialogTitle>
              <DialogDescription>
                Update the email template configuration
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Template Name</Label>
                  <Input id="edit-name" {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select
                    value={form.watch('category')}
                    onValueChange={(value) => form.setValue('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.category && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.category.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject">Email Subject</Label>
                <Input id="edit-subject" {...form.register('subject')} />
                {form.formState.errors.subject && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.subject.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-body">Email Body</Label>
                <RichTextEditor
                  value={form.watch('body') || ''}
                  onChange={(value) => form.setValue('body', value)}
                  placeholder="Start typing your email body... Use {{variables}} for dynamic content"
                />
                {form.formState.errors.body && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.body.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-variables">Variables (comma-separated)</Label>
                <Input id="edit-variables" {...form.register('variables')} />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Template
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Preview Email Template</DialogTitle>
              <DialogDescription>
                Test the template with sample variables
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="form" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">Variables</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="space-y-4">
                <form onSubmit={previewForm.handleSubmit(handlePreview)} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Variables (JSON)</Label>
                    <Textarea
                      {...previewForm.register('variables')}
                      rows={8}
                      className="font-mono text-sm"
                      placeholder='{"user_name": "John Doe", "po_number": "PO-001"}'
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide variable values as JSON to preview the rendered template
                    </p>
                  </div>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Preview
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="preview" className="space-y-4">
                {previewHtml ? (
                  <div
                    className="border rounded-lg p-4 max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No preview generated yet. Fill in the variables and click "Generate Preview".
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Test Send Dialog */}
        <Dialog open={isTestSendDialogOpen} onOpenChange={setIsTestSendDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
              <DialogDescription>
                Send a test email to verify the template
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={testSendForm.handleSubmit(handleTestSend)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Recipient Email</Label>
                <Input
                  id="test-email"
                  type="email"
                  {...testSendForm.register('email')}
                  placeholder="test@example.com"
                />
                {testSendForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {testSendForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Variables (JSON)</Label>
                <Textarea
                  {...testSendForm.register('variables')}
                  rows={6}
                  className="font-mono text-sm"
                  placeholder='{"user_name": "John Doe", "po_number": "PO-001"}'
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsTestSendDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Email
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the email template "{selectedTemplate?.name}".
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Template
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
