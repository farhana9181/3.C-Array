#include <iostream>
using namespace std;
int main()
{
   int a[100],n,i,sum=0,rem;
   cout<<"***Enter some Number for seeing reverse number ***"<<endl;
   cout<<"How many numbers you want to input = ";
   cin>>n;
   cout<<"Input ="<<endl;
   for( i=0;i<n; i++)
   {
       cout<<"n["<<i<<"] =";
       cin>>a[i];
   }
   cout<<"Number ="<<endl;
      for( i=0;i<n; i++)
   {
       cout<<a[i]<<"\t";
   }
cout<<endl<<"reverse number "<<endl;
      for( i=(n-1);i>=0; i--)
   {
       cout<<a[i]<<"\t";
   }

}
