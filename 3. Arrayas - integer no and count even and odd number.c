//	ARRAYAS integer no and count even and odd.
#include<stdio.h>
void main(){
int num[10],i,n,even=0 , odd=0 ;
printf("How many elemants you want to take ? = \t");
scanf("%d",&n);
 printf("Enter the elements number =\n");
for(i=0;i<n;i++)
{
    printf("num[%d] = \t",i);
    scanf("%d",&num[i]);
}
printf("\n \n Even numbers  are =  \n");
for(i=0;i<n;i++)
{
    if(num[i]%2==0)
    {
    printf("%d\t \n",num[i]);
    even++;
    }
}
printf("Odd numbers  are = \n");
for(i=0;i<n;i++)
{
   if(num[i]%2!=0)
   {
   printf("odd= %d\t \n",num[i]);
   odd++;
   }
}

 printf("Total Even  numbers = %d\n",even);
 printf("Total Odd  numbers = %d\n",odd);
}
