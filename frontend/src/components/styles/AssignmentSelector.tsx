'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  company: string | null;
}

interface AssignmentSelectorProps {
  assignmentType: 'direct_to_factory' | 'via_agency' | null;
  assignedFactoryId: number | null;
  assignedAgencyId: number | null;
  onAssignmentChange: (data: {
    assignmentType: 'direct_to_factory' | 'via_agency' | null;
    assignedFactoryId: number | null;
    assignedAgencyId: number | null;
  }) => void;
  disabled?: boolean;
}

export function AssignmentSelector({
  assignmentType,
  assignedFactoryId,
  assignedAgencyId,
  onAssignmentChange,
  disabled = false,
}: AssignmentSelectorProps) {
  const [factories, setFactories] = useState<User[]>([]);
  const [agencies, setAgencies] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Fetch factories
      const factoriesResponse = await api.get('/admin/users', {
        params: { role: 'factory' },
      });
      setFactories(factoriesResponse.data.users || factoriesResponse.data);

      // Fetch agencies
      const agenciesResponse = await api.get('/admin/users', {
        params: { role: 'agency' },
      });
      setAgencies(agenciesResponse.data.users || agenciesResponse.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (value: string) => {
    const type = value as 'direct_to_factory' | 'via_agency';
    onAssignmentChange({
      assignmentType: type,
      assignedFactoryId: type === 'direct_to_factory' ? assignedFactoryId : null,
      assignedAgencyId: type === 'via_agency' ? assignedAgencyId : null,
    });
  };

  const handleFactoryChange = (value: string) => {
    onAssignmentChange({
      assignmentType,
      assignedFactoryId: value === '0' ? null : parseInt(value),
      assignedAgencyId,
    });
  };

  const handleAgencyChange = (value: string) => {
    onAssignmentChange({
      assignmentType,
      assignedFactoryId,
      assignedAgencyId: parseInt(value),
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="space-y-3">
        <Label className="text-base font-semibold">Assignment Type</Label>
        <RadioGroup
          value={assignmentType || ''}
          onValueChange={handleTypeChange}
          disabled={disabled}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="direct_to_factory" id="direct" />
            <Label htmlFor="direct" className="flex-1 cursor-pointer">
              <div className="font-medium">Direct to Factory</div>
              <div className="text-xs text-muted-foreground">
                Assign this style directly to a factory
              </div>
            </Label>
          </div>
          <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="via_agency" id="via_agency" />
            <Label htmlFor="via_agency" className="flex-1 cursor-pointer">
              <div className="font-medium">Via Agency</div>
              <div className="text-xs text-muted-foreground">
                Assign to an agency, who will then assign to a factory
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Direct to Factory - Show Factory Selector */}
      {assignmentType === 'direct_to_factory' && (
        <div className="space-y-2 pl-6 border-l-2 border-primary/20">
          <Label htmlFor="factory-select">Select Factory *</Label>
          <Select
            value={assignedFactoryId?.toString() || ''}
            onValueChange={handleFactoryChange}
            disabled={disabled}
          >
            <SelectTrigger id="factory-select">
              <SelectValue placeholder="Choose a factory..." />
            </SelectTrigger>
            <SelectContent>
              {factories.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No factories available</div>
              ) : (
                factories.map((factory) => (
                  <SelectItem key={factory.id} value={factory.id.toString()}>
                    <div className="flex flex-col">
                      <span className="font-medium">{factory.name}</span>
                      {factory.company && (
                        <span className="text-xs text-muted-foreground">{factory.company}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Via Agency - Show Agency & Optional Factory Selector */}
      {assignmentType === 'via_agency' && (
        <div className="space-y-4 pl-6 border-l-2 border-primary/20">
          <div className="space-y-2">
            <Label htmlFor="agency-select">Select Agency *</Label>
            <Select
              value={assignedAgencyId?.toString() || ''}
              onValueChange={handleAgencyChange}
              disabled={disabled}
            >
              <SelectTrigger id="agency-select">
                <SelectValue placeholder="Choose an agency..." />
              </SelectTrigger>
              <SelectContent>
                {agencies.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No agencies available</div>
                ) : (
                  agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id.toString()}>
                      <div className="flex flex-col">
                        <span className="font-medium">{agency.name}</span>
                        {agency.company && (
                          <span className="text-xs text-muted-foreground">{agency.company}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="factory-select-via-agency">Suggested Factory (Optional)</Label>
            <Select
              value={assignedFactoryId?.toString() || '0'}
              onValueChange={handleFactoryChange}
              disabled={disabled}
            >
              <SelectTrigger id="factory-select-via-agency">
                <SelectValue placeholder="Optionally suggest a factory..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">None</SelectItem>
                {factories.map((factory) => (
                  <SelectItem key={factory.id} value={factory.id.toString()}>
                    <div className="flex flex-col">
                      <span className="font-medium">{factory.name}</span>
                      {factory.company && (
                        <span className="text-xs text-muted-foreground">{factory.company}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The agency can change the factory assignment later
            </p>
          </div>
        </div>
      )}

      {!assignmentType && (
        <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
          Please select an assignment type to continue
        </div>
      )}
    </div>
  );
}
