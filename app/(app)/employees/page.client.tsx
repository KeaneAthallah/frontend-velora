"use client";

// Opt out of instant-navigation validation: these pages render data-dependent client UI.
export const instant = false;


import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  KeyRound,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  Badge,
  Button,
  Checkbox,
  ChipButton,
  EmptyState,
  Field,
  Input,
  Select,
} from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { AccessDenied, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import {
  inviteEmployee,
  listEmployees,
  listRoles,
  removeEmployee,
  updateEmployee,
} from "@/lib/api/employees";
import type { Employee, Outlet, Role } from "@/lib/api/types";
import { formatDate } from "@/lib/formatting/currency";
import { useAuth, usePermissions } from "@/lib/auth/auth-context";
import { useBusiness } from "@/lib/business/context";
import { initials } from "@/components/ui/primitives";

type StatusFilter = "all" | "active" | "inactive" | "invited";

const STATUS_TONE: Record<string, "success" | "neutral" | "warning"> = {
  active: "success",
  inactive: "neutral",
  invited: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  invited: "Invited",
};

export default function EmployeesPage() {
  const { has } = usePermissions();
  const { session } = useAuth();
  const { outlets, outletId: currentOutletId } = useBusiness();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [roleId, setRoleId] = React.useState("all");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Employee | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: listEmployees,
    enabled: has("employees.view"),
    staleTime: 30_000,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: listRoles,
    enabled: has("employees.view"),
    staleTime: 5 * 60_000,
  });

  const canManage = has("employees.manage");
  const canAssignOutlets = has("outlets.view");
  const employees = React.useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const roles = React.useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (status !== "all" && (employee.status ?? (employee.active ? "active" : "inactive")) !== status) {
        return false;
      }
      if (roleId !== "all" && employee.roleId !== roleId) return false;
      if (!query) return true;
      return (
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.role.toLowerCase().includes(query)
      );
    });
  }, [employees, search, status, roleId]);

  if (!has("employees.view")) {
    return <AccessDenied permission="employees.view" />;
  }

  const activeCount = employees.filter((employee) => employee.active).length;

  const columns: Column<Employee>[] = [
    {
      id: "member",
      header: "Member",
      cell: (row) => (
        <div className="row" style={{ gap: 9 }}>
          <span className="avatar" aria-hidden="true">
            {initials(row.name || row.email)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>
              {row.name || "Unnamed member"}
              {row.userId === session?.user.id ? <span className="hint"> · you</span> : null}
            </div>
            <div className="hint" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {row.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: (row) => {
        const role = roles.find((item) => item.id === row.roleId);
        return (
          <div>
            <Badge tone="neutral">{row.role || "No role"}</Badge>
            {role?.description ? (
              <div className="hint" style={{ marginTop: 3, maxWidth: 250 }}>
                {role.description}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "outlets",
      header: "Outlet access",
      cell: (row) => {
        const allOutlets = hasBusinessWideOutletAccess(row, roles);
        const names = row.outlets
          .map((id) => outlets.find((outlet) => outlet.id === id)?.name)
          .filter((name): name is string => Boolean(name));
        return (
          <div>
            <Badge tone={allOutlets || row.outlets.length ? "neutral" : "warning"}>
              {allOutlets
                ? "All outlets"
                : row.outlets.length
                  ? `${row.outlets.length} ${row.outlets.length === 1 ? "outlet" : "outlets"}`
                  : "None"}
            </Badge>
            {!allOutlets && names.length ? (
              <div
                className="hint"
                style={{ marginTop: 3, maxWidth: 180 }}
                title={names.join(", ")}
              >
                {names[0]}
                {names.length > 1 ? ` +${names.length - 1}` : ""}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const value = row.status ?? (row.active ? "active" : "inactive");
        return (
          <Badge tone={STATUS_TONE[value] ?? "neutral"} dot>
            {STATUS_LABEL[value] ?? value}
          </Badge>
        );
      },
    },
    {
      id: "joined",
      header: "Joined",
      cell: (row) => <span className="cell-muted">{row.joinedAt ? formatDate(row.joinedAt) : "—"}</span>,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          variant="quiet"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(row);
          }}
        >
          {canManage && row.userId !== session?.user.id ? "Manage" : "View"}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Team & access"
        description="Who can sign in, the role they hold, the outlets they can work in, and whether their access is active."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              <Plus aria-hidden="true" />
              Add member
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="toolbar" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <label className="toolbar__search input-affix">
            <Search aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or role"
              aria-label="Search team members"
            />
            {search ? (
              <button type="button" className="icon-btn" onClick={() => setSearch("")} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div className="chips" role="group" aria-label="Filter by status">
            <ChipButton active={status === "all"} onClick={() => setStatus("all")}>
              All
            </ChipButton>
            <ChipButton active={status === "active"} onClick={() => setStatus("active")}>
              Active
            </ChipButton>
            <ChipButton active={status === "inactive"} onClick={() => setStatus("inactive")}>
              Inactive
            </ChipButton>
            <ChipButton active={status === "invited"} onClick={() => setStatus("invited")}>
              Invited
            </ChipButton>
          </div>
          <Select
            aria-label="Filter by role"
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            style={{ width: "auto", minWidth: 130 }}
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
          <div className="spacer" />
          <span className="hint" style={{ margin: 0, whiteSpace: "nowrap" }}>
            {employeesQuery.isLoading ? "Loading…" : `${formatNumberLike(activeCount)} active of ${formatNumberLike(employees.length)}`}
          </span>
        </div>

        {employeesQuery.isError ? (
          <InlineError
            title="Team members could not be loaded"
            error={employeesQuery.error}
            onRetry={() => employeesQuery.refetch()}
          />
        ) : (
          <DataTable
            rows={filtered}
            columns={columns}
            rowId={(row) => row.id}
            loading={employeesQuery.isLoading && !employeesQuery.data}
            onRowClick={(row) => setSelected(row)}
            minWidth={840}
            empty={
              <EmptyState
                icon={<UserRound aria-hidden="true" />}
                title={
                  employees.length === 0
                    ? "No team members yet"
                    : "No members match these filters"
                }
                description={
                  employees.length === 0
                    ? "Add a member to grant access to this business."
                    : "Try another status, role, or search term."
                }
                actions={
                  employees.length === 0 && canManage ? (
                    <Button variant="primary" onClick={() => setInviteOpen(true)}>
                      Add first member
                    </Button>
                  ) : employees.length > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch("");
                        setStatus("all");
                        setRoleId("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            }
            mobile={(row) => (
              <button
                type="button"
                className="record"
                onClick={() => setSelected(row)}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
              >
                <div className="record__top">
                  <div className="row" style={{ minWidth: 0 }}>
                    <span className="avatar" aria-hidden="true">
                      {initials(row.name || row.email)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="record__title">
                        {row.name || "Unnamed member"}
                        {row.userId === session?.user.id ? " · you" : ""}
                      </div>
                      <div className="record__meta">{row.email}</div>
                      <div className="row row-tight" style={{ marginTop: 6 }}>
                        <Badge tone={STATUS_TONE[row.status ?? ""] ?? "neutral"} dot>
                          {STATUS_LABEL[row.status ?? ""] ?? (row.active ? "Active" : "Inactive")}
                        </Badge>
                        <span className="hint" style={{ margin: 0 }}>
                          {row.role}
                        </span>
                      </div>
                      <div className="hint" style={{ marginTop: 4 }}>
                        {hasBusinessWideOutletAccess(row, roles)
                          ? "All outlets"
                          : row.outlets.length
                            ? `${row.outlets.length} ${row.outlets.length === 1 ? "outlet" : "outlets"}`
                            : "No outlet access"}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )}
          />
        )}
        <div className="hint" style={{ padding: "0 16px 12px" }}>
          The team endpoint returns up to 50 memberships. Role and outlet changes take effect on the member&apos;s next
          request.
        </div>
      </Card>

      <RoleReference roles={roles} loading={rolesQuery.isLoading} error={rolesQuery.error} />

      <InviteMemberSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roles={roles}
        outlets={outlets}
        canAssignOutlets={canAssignOutlets}
        currentOutletId={currentOutletId}
        onAdded={() => {
          setInviteOpen(false);
          void employeesQuery.refetch();
        }}
      />

      <MemberSheet
        member={selected}
        roles={roles}
        outlets={outlets}
        canAssignOutlets={canAssignOutlets}
        canManage={canManage}
        isSelf={selected?.userId === session?.user.id}
        onClose={() => setSelected(null)}
        onChanged={() => {
          void employeesQuery.refetch();
        }}
      />
    </>
  );
}

function formatNumberLike(value: number) {
  return new Intl.NumberFormat().format(value);
}

function isAllOutletRole(role?: { slug?: string; name?: string }) {
  const value = (role?.slug ?? role?.name ?? "").toLowerCase();
  return value === "owner" || value === "admin";
}

function hasBusinessWideOutletAccess(employee: Employee, roles: Role[]) {
  const role = roles.find((item) => item.id === employee.roleId);
  return isAllOutletRole({
    slug: employee.roleSlug ?? role?.slug,
    name: role?.name ?? employee.role,
  });
}

function RoleReference({
  roles,
  loading,
  error,
}: {
  roles: Role[];
  loading: boolean;
  error: unknown;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <Card>
      <div className="card-section-head">
        <div>
          <h2>Roles</h2>
          <p>Roles decide which actions a member can perform. Outlet assignments decide where those actions apply.</p>
        </div>
        <ShieldCheck aria-hidden="true" className="card-section-head__icon" />
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        {loading ? (
          <p className="hint" style={{ margin: 0 }}>
            Loading roles…
          </p>
        ) : error ? (
          <p className="hint" style={{ margin: 0 }}>
            Roles could not be loaded. Member roles still appear in the table above.
          </p>
        ) : roles.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            No roles were returned for this business.
          </p>
        ) : (
          <div className="role-list">
            {roles.map((role) => {
              const open = expanded === role.id;
              return (
                <div className="role-row" key={role.id}>
                  <div className="role-row__head">
                    <div>
                      <div className="row row-tight">
                        <b>{role.name}</b>
                        <Badge tone="neutral">
                          {role.permissions.length} {role.permissions.length === 1 ? "permission" : "permissions"}
                        </Badge>
                      </div>
                      {role.description ? <p className="hint">{role.description}</p> : null}
                    </div>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setExpanded(open ? null : role.id)}
                      aria-expanded={open}
                    >
                      {open ? "Hide" : "View"} permissions
                    </Button>
                  </div>
                  {open ? (
                    <div className="permission-chips">
                      {role.permissions.length === 0 ? (
                        <span className="hint">This role has no permissions.</span>
                      ) : (
                        role.permissions.map((permission) => (
                          <span className="permission-chip" key={permission}>
                            <Check aria-hidden="true" />
                            {permission}
                          </span>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <p className="hint" style={{ margin: "10px 0 0" }}>
          Permission sets are managed through the roles API. This screen assigns existing roles and outlet access; it
          does not create or edit role definitions.
        </p>
      </div>
    </Card>
  );
}

function InviteMemberSheet({
  open,
  onClose,
  roles,
  outlets,
  canAssignOutlets,
  currentOutletId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
  outlets: Outlet[];
  canAssignOutlets: boolean;
  currentOutletId: string | null;
  onAdded: () => void;
}) {
  const { push } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [outletIds, setOutletIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setEmail("");
    setRoleId(roles.find((role) => role.name.toLowerCase() === "cashier")?.id ?? roles[0]?.id ?? "");
    const defaultOutlet = currentOutletId ?? outlets[0]?.id ?? "";
    setOutletIds(canAssignOutlets && defaultOutlet ? [defaultOutlet] : []);
    setError(null);
  }, [open, roles, outlets, currentOutletId, canAssignOutlets]);

  const toggleOutlet = (id: string) => {
    setOutletIds((current) =>
      current.includes(id) ? current.filter((outletId) => outletId !== id) : [...current, id]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const value = email.trim().toLowerCase();
      if (!value) throw new Error("Enter the email address for the member.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Enter a valid email address.");
      if (!roleId) throw new Error("Choose a role.");
      const role = roles.find((item) => item.id === roleId);
      if (canAssignOutlets && !isAllOutletRole(role) && outlets.length > 0 && outletIds.length === 0) {
        throw new Error("Choose at least one outlet for this member.");
      }
      await inviteEmployee({
        email: value,
        roleId,
        outletIds: canAssignOutlets && !isAllOutletRole(role) ? outletIds : undefined,
      });
    },
    onSuccess: () => {
      push({
        title: "Access added",
        description: `${email.trim().toLowerCase()} can use the permissions in the selected role. No invitation email is sent.`,
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
      onAdded();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The member could not be added.");
    },
  });

  const selectedRole = roles.find((role) => role.id === roleId);

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title="Add team member"
      description="Grant an email address access to this business with an existing role and outlet access."
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            <UserRound aria-hidden="true" />
            Add member
          </Button>
        </>
      }
    >
      <form
        className="stack"
        style={{ gap: 15 }}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}

        <div className="alert alert--warning">
          <div>
            <b>Access is immediate.</b>
            <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
              This action creates or links the account. Velora does not send an invitation email. If the person is
              new, they must use password recovery on the sign-in screen before their first sign-in.
            </p>
          </div>
        </div>

        <Field label="Email address" htmlFor="invite-email" required>
          <div className="input-affix">
            <Mail aria-hidden="true" />
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@business.com"
              autoFocus
            />
          </div>
        </Field>

        <Field
          label="Role"
          htmlFor="invite-role"
          required
          hint={selectedRole?.description ?? "The role's permissions apply at the selected outlets."}
        >
          <Select id="invite-role" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            {roles.length === 0 ? <option value="">No roles available</option> : null}
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>

        {canAssignOutlets ? (
          <Field
            label="Outlet access"
            hint="Choose where this member can work. Register access requires at least one outlet."
          >
            {selectedRole && isAllOutletRole(selectedRole) ? (
              <div className="inset hint" style={{ margin: 0 }}>
                Owner and admin roles always have access to every outlet. No outlet assignment is required.
              </div>
            ) : outlets.length === 0 ? (
              <div className="inset hint" style={{ margin: 0 }}>
                No outlets exist yet. Create an outlet in Settings before adding register staff.
              </div>
            ) : (
              <div
                id="invite-outlets"
                className="inset stack"
                style={{ gap: 10, maxHeight: 220, overflowY: "auto" }}
                role="group"
                aria-label="Outlet access"
              >
                {outlets.map((outlet) => (
                  <Checkbox
                    key={outlet.id}
                    label={outlet.name}
                    description={outlet.code ? `Code ${outlet.code}` : undefined}
                    checked={outletIds.includes(outlet.id)}
                    onChange={() => toggleOutlet(outlet.id)}
                  />
                ))}
              </div>
            )}
          </Field>
        ) : (
          <div className="alert alert--warning">
            Your role cannot view outlets, so outlet access cannot be assigned here. Ask an owner or manager with
            outlet access to update this member afterward.
          </div>
        )}

        {selectedRole ? (
          <div className="inset">
            <div className="row between">
              <span className="eyebrow" style={{ margin: 0 }}>
                This role can
              </span>
              <span className="hint" style={{ margin: 0 }}>
                {selectedRole.permissions.length} permissions
              </span>
            </div>
            <div className="permission-chips" style={{ marginTop: 8 }}>
              {selectedRole.permissions.slice(0, 8).map((permission) => (
                <span className="permission-chip" key={permission}>
                  {permission}
                </span>
              ))}
              {selectedRole.permissions.length > 8 ? (
                <span className="permission-chip">+{selectedRole.permissions.length - 8} more</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}

function MemberSheet({
  member,
  roles,
  outlets,
  canAssignOutlets,
  canManage,
  isSelf,
  onClose,
  onChanged,
}: {
  member: Employee | null;
  roles: Role[];
  outlets: Outlet[];
  canAssignOutlets: boolean;
  canManage: boolean;
  isSelf: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { push } = useToast();
  const [roleId, setRoleId] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "inactive" | "invited">("active");
  const [outletIds, setOutletIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!member) return;
    setRoleId(member.roleId ?? "");
    setStatus((member.status as "active" | "inactive" | "invited") ?? (member.active ? "active" : "inactive"));
    setOutletIds([...member.outlets]);
    setError(null);
    setDeleteOpen(false);
  }, [member]);

  const toggleOutlet = (id: string) => {
    setOutletIds((current) =>
      current.includes(id) ? current.filter((outletId) => outletId !== id) : [...current, id]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error("No member selected.");
      if (!roleId) throw new Error("Choose a role.");
      const role = roles.find((item) => item.id === roleId);
      if (canAssignOutlets && !isAllOutletRole(role) && outlets.length > 0 && outletIds.length === 0) {
        throw new Error("Choose at least one outlet for this member.");
      }
      await updateEmployee(member.id, {
        roleId,
        status,
        outletIds: canAssignOutlets && outlets.length > 0 && !isAllOutletRole(role) ? outletIds : undefined,
      });
    },
    onSuccess: () => {
      push({
        title: "Member updated",
        description: `${member?.name || member?.email} now has the selected role, outlets, and access status.`,
        variant: "success",
      });
      onChanged();
      onClose();
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : "The member could not be updated.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error("No member selected.");
      await removeEmployee(member.id);
    },
    onSuccess: () => {
      push({
        title: "Access removed",
        description: `${member?.name || member?.email} was removed from this business.`,
        variant: "success",
      });
      setDeleteOpen(false);
      onChanged();
      onClose();
    },
    onError: (error) => {
      setDeleteOpen(false);
      setError(error instanceof Error ? error.message : "The member could not be removed.");
    },
  });

  if (!member) return null;

  const editable = canManage && !isSelf;
  const selectedRole = roles.find((role) => role.id === roleId);

  return (
    <>
      <Sheet
        open={Boolean(member)}
        onClose={onClose}
        title={member.name || "Team member"}
        description={member.email}
        width={500}
        footer={
          <>
            {editable ? (
              <Button
                variant="danger-quiet"
                onClick={() => setDeleteOpen(true)}
                disabled={saveMutation.isPending}
              >
                <Trash2 aria-hidden="true" />
                Remove access
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onClose} disabled={saveMutation.isPending} style={{ marginLeft: editable ? 0 : "auto" }}>
              Close
            </Button>
            {editable ? (
              <Button variant="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Save changes
              </Button>
            ) : null}
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="avatar" style={{ width: 46, height: 46, fontSize: 15 }} aria-hidden="true">
              {initials(member.name || member.email)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650, fontSize: 15 }}>{member.name || "Unnamed member"}</div>
              <div className="hint">{member.email}</div>
              <div className="row row-tight" style={{ marginTop: 6 }}>
                <Badge tone={STATUS_TONE[member.status ?? ""] ?? "neutral"} dot>
                  {STATUS_LABEL[member.status ?? ""] ?? (member.active ? "Active" : "Inactive")}
                </Badge>
                {isSelf ? <span className="hint">This is your account</span> : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          ) : null}

          {isSelf ? (
            <div className="alert alert--info">
              <KeyRound aria-hidden="true" />
              <div>
                <b>You cannot change your own access here.</b>
                <p className="hint" style={{ margin: "3px 0 0", color: "inherit" }}>
                  Ask another manager or owner to change your role or status. This prevents accidentally locking
                  yourself out.
                </p>
              </div>
            </div>
          ) : null}

          {!canManage && !isSelf ? (
            <div className="alert alert--info">
              Your role can view team access but cannot change roles or remove members.
            </div>
          ) : null}

          <div className="grid-2" style={{ gap: 12 }}>
            <Field
              label="Role"
              htmlFor="member-role"
              hint={selectedRole?.description ?? undefined}
              required
            >
              <Select
                id="member-role"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                disabled={!editable}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Access status" htmlFor="member-status" hint="Inactive members cannot sign in.">
              <Select
                id="member-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as "active" | "inactive" | "invited")}
                disabled={!editable}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="invited">Invited</option>
              </Select>
            </Field>
          </div>

          {canAssignOutlets ? (
            <Field
              label="Outlet access"
              hint="Register access requires at least one outlet. Changes apply on the member's next request."
            >
              {selectedRole && isAllOutletRole(selectedRole) ? (
                <div className="inset hint" style={{ margin: 0 }}>
                  Owner and admin roles always have access to every outlet. No outlet assignment is required.
                </div>
              ) : outlets.length === 0 ? (
                <div className="inset hint" style={{ margin: 0 }}>
                  No outlets exist yet. Create an outlet in Settings before assigning register access.
                </div>
              ) : (
                <div
                  id="member-outlets"
                  className="inset stack"
                  style={{ gap: 10, maxHeight: 220, overflowY: "auto" }}
                  role="group"
                  aria-label="Outlet access"
                >
                  {outlets.map((outlet) => (
                    <Checkbox
                      key={outlet.id}
                      label={outlet.name}
                      description={outlet.code ? `Code ${outlet.code}` : undefined}
                      checked={outletIds.includes(outlet.id)}
                      onChange={() => toggleOutlet(outlet.id)}
                      disabled={!editable}
                    />
                  ))}
                </div>
              )}
            </Field>
          ) : (
            <div className="inset">
              <div className="row between wrap">
                <span className="eyebrow" style={{ margin: 0 }}>
                  Outlet access
                </span>
                <Badge
                  tone={
                    (selectedRole && isAllOutletRole(selectedRole)) || member.outlets.length
                      ? "neutral"
                      : "warning"
                  }
                >
                  {selectedRole && isAllOutletRole(selectedRole)
                    ? "All outlets"
                    : member.outlets.length
                      ? `${member.outlets.length} ${member.outlets.length === 1 ? "outlet" : "outlets"}`
                      : "None"}
                </Badge>
              </div>
              <p className="hint" style={{ margin: "6px 0 0" }}>
                {selectedRole && isAllOutletRole(selectedRole)
                  ? "This role always has access to every outlet."
                  : "Your role cannot view outlets, so outlet names and assignments are not shown here."}
              </p>
            </div>
          )}

          <div className="inset">
            <div className="row between wrap">
              <div>
                <div className="eyebrow" style={{ marginBottom: 2 }}>
                  Joined
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 550 }}>
                  {member.joinedAt ? formatDate(member.joinedAt) : "Not recorded"}
                </div>
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 2 }}>
                  Permissions in this role
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 550 }}>
                  {selectedRole?.permissions.length ?? 0}
                </div>
              </div>
            </div>
          </div>

          {editable && selectedRole ? (
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                Effective permissions
              </div>
              <div className="permission-chips">
                {selectedRole.permissions.length === 0 ? (
                  <span className="hint">No permissions in this role.</span>
                ) : (
                  selectedRole.permissions.map((permission) => (
                    <span className="permission-chip" key={permission}>
                      {permission}
                    </span>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Remove this member's access?"
        description={
          <>
            <b>{member.name || member.email}</b> will lose access to this business and its outlets immediately. Their
            user account and sales history are not deleted. You can add the email again later.
          </>
        }
        confirmLabel="Remove access"
        loading={deleteMutation.isPending}
      />
    </>
  );
}
