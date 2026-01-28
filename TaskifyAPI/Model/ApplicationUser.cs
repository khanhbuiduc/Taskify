using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace TaskifyAPI.Model
{
    /// <summary>
    /// Extended IdentityUser with additional properties
    /// FullName is stored in UserName property (from IdentityUser)
    /// </summary>
    public class ApplicationUser : IdentityUser
    {
        /// <summary>
        /// Avatar image URL
        /// </summary>
        [MaxLength(500)]
        public string? AvatarUrl { get; set; }
    }
}
