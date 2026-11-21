import { Customer, User } from './types';

export const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    mobile: '+91 98765 43210',
    address: '123 MG Road, Bangalore',
    subscriptionStartDate: '2025-11-15',
    renewalDate: '2026-02-15',
    status: 'renewed',
    renewalCycle: 'monthly'
  },
  {
    id: '2',
    name: 'Priya Sharma',
    mobile: '+91 98765 43211',
    address: '456 Park Street, Mumbai',
    subscriptionStartDate: '2025-12-01',
    renewalDate: '2026-02-20',
    status: 'pending',
    renewalCycle: 'monthly'
  },
  {
    id: '3',
    name: 'Amit Patel',
    mobile: '+91 98765 43212',
    address: '789 Nehru Place, Delhi',
    subscriptionStartDate: '2025-10-10',
    renewalDate: '2026-01-10',
    status: 'expired',
    renewalCycle: 'monthly'
  },
  {
    id: '4',
    name: 'Sneha Reddy',
    mobile: '+91 98765 43213',
    address: '321 Brigade Road, Bangalore',
    subscriptionStartDate: '2025-11-20',
    renewalDate: '2026-02-20',
    status: 'renewed',
    renewalCycle: 'monthly'
  },
  {
    id: '5',
    name: 'Vikram Singh',
    mobile: '+91 98765 43214',
    address: '654 Anna Salai, Chennai',
    subscriptionStartDate: '2025-12-05',
    renewalDate: '2026-02-25',
    status: 'pending',
    renewalCycle: 'monthly'
  },
  {
    id: '6',
    name: 'Anita Verma',
    mobile: '+91 98765 43215',
    address: '987 Connaught Place, Delhi',
    subscriptionStartDate: '2025-09-15',
    renewalDate: '2025-12-15',
    status: 'expired',
    renewalCycle: 'monthly'
  },
  {
    id: '7',
    name: 'Deepak Joshi',
    mobile: '+91 98765 43216',
    address: '147 FC Road, Pune',
    subscriptionStartDate: '2025-11-25',
    renewalDate: '2026-02-25',
    status: 'renewed',
    renewalCycle: 'monthly'
  },
  {
    id: '8',
    name: 'Kavita Nair',
    mobile: '+91 98765 43217',
    address: '258 MG Road, Kochi',
    subscriptionStartDate: '2025-12-10',
    renewalDate: '2026-03-01',
    status: 'pending',
    renewalCycle: 'monthly'
  },
  {
    id: '9',
    name: 'Suresh Rao',
    mobile: '+91 98765 43218',
    address: '369 Residency Road, Bangalore',
    subscriptionStartDate: '2025-11-01',
    renewalDate: '2026-02-01',
    status: 'renewed',
    renewalCycle: 'monthly'
  },
  {
    id: '10',
    name: 'Meena Krishnan',
    mobile: '+91 98765 43219',
    address: '741 Besant Nagar, Chennai',
    subscriptionStartDate: '2025-12-15',
    renewalDate: '2026-02-28',
    status: 'pending',
    renewalCycle: 'monthly'
  }
];

export const mockUsers: User[] = [
  {
    id: '1',
    fullName: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    businessName: 'Fresh Fruit Packs'
  },
  {
    id: '2',
    fullName: 'Ravi Kumar',
    email: 'ravi.kumar@example.com',
    role: 'admin',
    businessName: 'Fresh Fruit Packs'
  },
  {
    id: '3',
    fullName: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    role: 'staff',
    businessName: 'Fresh Fruit Packs'
  },
  {
    id: '4',
    fullName: 'Amit Patel',
    email: 'amit.patel@example.com',
    role: 'staff',
    businessName: 'Fresh Fruit Packs'
  },
  {
    id: '5',
    fullName: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    role: 'staff',
    businessName: 'Fresh Fruit Packs'
  }
];